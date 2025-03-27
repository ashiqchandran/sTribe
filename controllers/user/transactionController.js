const Transaction = require("../../models/transactionSchema");
const User = require("../../models/userSchema"); // Import the User model
const Order = require("../../models/orderSchema");

const Cart=require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const mongoose = require('mongoose');
const walletPayment = async (req, res) => {
  try {
        const userId = req.session.user._id;
        console.log("user id = ", userId);
        const { addressId, amount } = req.body;

        console.log("address id = ", addressId);

        // Step 1: Check if wallet has enough balance before proceeding with order placement
        let user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        console.log("transaction userid =", userId);

        // Ensure that 'amount' is a valid number
        const paymentAmount = Number(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid payment amount.'
            });
        }

        // Check if the wallet has sufficient balance
        if (user.wallet < paymentAmount) {
            return res.status(400).json({
                success: false,
                message: 'Insufficient wallet balance.',
            });
        }

        // Step 2: Deduct the wallet amount
        user.wallet -= paymentAmount;

        // Ensure that the wallet value is a valid number before saving
        if (isNaN(user.wallet)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid wallet balance after deduction.',
            });
        }

        await user.save();

        // Step 3: Create a transaction record for the wallet payment
        const transaction = new Transaction({
            userId: user._id,
            amount: paymentAmount,
            transactionType: 'payment',
            status: 'success',
        });
        await transaction.save();
        console.log("Wallet transaction saved successfully");
        const trans = await Transaction.find({}).sort({ date: -1 }).limit(1);
        console.log("last transaction id = ",trans[0]._id)
        // Aggregate to fetch cart and product details
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
                  _id: 0,
                  userId:"$userId",
                  productId: "$productDetails._id",
                  productImage:"$productDetails.productImage",
                  size:"$productDetails.size",
                  color:"$productDetails.color",
                  productName: "$productDetails.productName",
                  salePrice: "$productDetails.salePrice",
                  quantity: "$items.quantity"
              }
          }
      ]);
     

      if (!cart || cart.length === 0) {
          return res.status(400).json({
              success: false,
              message: 'Cart is empty'
          });
      }

      // Get address details
      const address = await Address.aggregate([
          { $match: { userId: new mongoose.Types.ObjectId(userId) } },
          { $unwind: "$address" },
          { $match: { "address._id": new mongoose.Types.ObjectId(addressId) } }
      ]);

      if (!address || address.length === 0) {
          return res.status(400).json({
              success: false,
              message: 'Address not found'
          });
      }

      const selectedAddress = address[0].address;

      // Create orders from cart items
      const orders = await Promise.all(cart.map(async (item) => {
          const order = new Order({
              
              orderItems: [{
                  product: item.productId,
                  orderProductImage:item.productImage[0],
                  orderProductName:item.productName,
                  size:item.size,
                  color:item.color,
                  quantity: item.quantity,
                  price: item.salePrice,
                  status: 'pending'
              }],
              userId: userId,
              totalPrice: item.salePrice * item.quantity,
              finalAmount: item.salePrice * item.quantity,
              address: selectedAddress,
              status: 'pending',
              createdOn: new Date(),
              transactionId:trans[0]._id
          });

          // Update the product quantity
          await Product.findByIdAndUpdate(item.productId, {
              $inc: { quantity: -item.quantity }
          });

          return order.save();
      }));
        // Step 6: Clear cart after placing the order
        // await Cart.findOneAndUpdate({ userId: userId }, { $set: { items: [] } });

        res.json({
            success: true,
            totalAmount: orders.map(order => order.finalAmount),
            orderIds: orders.map(order => order._id),
            message: 'Orders placed successfully',
        });

    } catch (error) {
        console.error('Error in placeOrder:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to place order',
        });
    }
};

module.exports={
    walletPayment
}