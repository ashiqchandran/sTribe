const Transaction = require("../../models/transactionSchema");
const User = require("../../models/userSchema"); // Import the User model
const Order = require("../../models/orderSchema");
const Coupon = require("../../models/couponSchema");
const Cart=require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const mongoose = require('mongoose');

const generateOrderGroupId = () => {
    return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  };
  
  const walletPayment = async (req, res) => {
    try {
      const orderGroupId = generateOrderGroupId();
      const userId = req.session.user._id;
      const { addressId, amount, couponCode } = req.body;  // coupon code=FREE100
      console.log("addressId = ",addressId)
      console.log("amount = ",amount)
      console.log("couponCode = " ,couponCode)
      const paymentAmount = Number(amount);
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return res.status(400).json({ success: false, message: 'Invalid payment amount.' });
      }
  
      // ✅ Get user and wallet
      const user = await User.findById(userId);
      if (!user || user.wallet < paymentAmount) {
        return res.status(400).json({ success: false, message: 'Insufficient wallet balance.' });
      }
  
      // ✅ Check coupon
      const coupon = couponCode ? await Coupon.findOne({ name: couponCode }) : null;
      const discountPercentage = coupon ? coupon.offerPrice : 0;
  
      // ✅ Fetch cart
      const cart = await Cart.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "_id",
            as: "productDetails"
          }
        },
        { $unwind: "$productDetails" },
        {
          $project: {
            userId: 1,
            productId: "$productDetails._id",
            productqty: "$productDetails.quantity",
            productImage: "$productDetails.productImage",
            size: "$productDetails.size",
            color: "$productDetails.color",
            productName: "$productDetails.productName",
            salePrice: "$productDetails.salePrice",
            quantity: "$items.quantity"
          }
        }
      ]);
  
      if (!cart || cart.length === 0) {
        return res.status(400).json({ success: false, message: 'Cart is empty.' });
      }
  
      // ❌ Check quantity mismatch
      for (const item of cart) {
        if (item.productqty < item.quantity) {
            for (const item of cart) {
                if (item.productqty < item.quantity) {
                  return res.status(400).json({
                    success: false,
                    message: `Out of stock for ${item.productName}`
                  });
                }
              }
                      }
      }
  
      // 🏠 Get selected address
      const address = await Address.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $unwind: "$address" },
        { $match: { "address._id": new mongoose.Types.ObjectId(addressId) } }
      ]);
  
      if (!address || address.length === 0) {
        return res.status(400).json({ success: false, message: 'Shipping address not found.' });
      }
  
      const selectedAddress = address[0].address;
  
      // 💰 Deduct wallet
      user.wallet -= paymentAmount;
      await user.save();
  
      // 📄 Create transaction
      const transaction = new Transaction({
        userId: user._id,
        amount: paymentAmount,
        transactionType: 'Wallet',
        status: 'Success',
        description: `Wallet payment of ₹${paymentAmount} for order placement`
      });
      await transaction.save();
  
      // 🧾 Create orders
      const orders = await Promise.all(cart.map(async (item) => {
        const discountAmount = discountPercentage
          ? Math.floor((discountPercentage / 100) * item.salePrice)
          : 0;
  
        const order = new Order({
          orderItems: [{
            product: item.productId,
            orderProductImage: item.productImage[0],
            orderProductName: item.productName,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            price: item.salePrice,
            status: 'pending',
            requestStatus:'pending'
          }],
          userId,
          discount: discountPercentage,
          totalPrice: item.salePrice * item.quantity,
          finalAmount: paymentAmount,
          address: selectedAddress,
          status: 'pending',
          createdOn: new Date(),
          transactionId: transaction._id,
          orderGroupId,
          
        });
  
        // ❗️Reduce product stock
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -item.quantity }
        });
  
        return order.save();
      }));
  
      // 🧹 Clear cart
      await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
  
      // ✅ Response
      return res.json({
        success: true,
        totalAmount: orders.map(order => order.finalAmount),
        orderIds: orders.map(order => order._id),
        message: 'Orders placed successfully',
      });
  
    } catch (error) {
      console.error('❌ Error in walletPayment:', error.message, error.stack);
      return res.status(500).json({
        success: false,
        message: 'An unexpected error occurred while placing the order.'
      });
    }
  };
  

module.exports={
    walletPayment
}