const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Cart=require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const Transaction = require("../../models/transactionSchema");
const Coupon =require("../../models/couponSchema");
const mongoose = require('mongoose');
const Razorpay = require('razorpay')
const { Schema, Types } = mongoose;
const PDFDocument = require('pdfkit');
const { tagmanager_v1 } = require("googleapis");

const ObjectId = Types.ObjectId; // This is the constructor for ObjectId


const getWalletBalance = async (req, res) => {
    try {
        const user = await User.findById(req.session.user._id)
            .select('wallet')
            .lean();
console.log("balance = ",user)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.status(200).json({
            success: true,
            walletBalance: user.wallet || 0
        });

    } catch (error) {
        console.error('Error fetching wallet balance:', error);
        res.status(500).json({
            success: false,
            message: 'Server error while fetching wallet balance'
        });
    }
};

const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        // console.log("user id = ", userId);
        const { addressId } = req.body;
        
        // console.log("address id = ", addressId);

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
                    userId: "$userId",
                    productId: "$productDetails._id",
                    productImage: "$productDetails.productImage",
                    size: "$productDetails.size",
                    color: "$productDetails.color",
                    productName: "$productDetails.productName",
                    salePrice: "$productDetails.salePrice",
                    productqty:"$productDetails.quantity",
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

        if(cart.productqty<cart.quantity)
        {
            return res.send("items quantity is less than the  sufficient")
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

        // Get the discount value from Coupon (ensure this is numeric)
        const discount = Coupon.discount ? parseFloat(Coupon.discount) : 0;  // Handle discount as a number

        // Create orders from cart items
        const orders = await Promise.all(cart.map(async (item) => {
            const order = new Order({
                orderItems: [{
                    product: item.productId,
                    orderProductImage: item.productImage[0],
                    orderProductName: item.productName,
                    size: item.size,
                    color: item.color,
                    quantity: item.quantity,
                    price: item.salePrice,
                    status: 'pending'
                }],
                userId: userId,
                discount: discount,
                totalPrice: item.salePrice * item.quantity,
                finalAmount: item.salePrice * item.quantity * (1 - discount / 100),
                address: selectedAddress,
                status: 'pending',
                createdOn: new Date(),
                orderGroupId: new mongoose.Types.ObjectId()  // Unique ObjectId
            });

            // Update the product quantity
            const count=  await Product.findByIdAndUpdate(item.productId, {
                $inc: { quantity: -item.quantity }
            });
            if(count>0)
            {
                return order.save();
            }
            else{
                return res.json({
                    success: true,
                    totalAmount: orders.map(order => order.finalAmount),
                    orderIds: orders.map(order => order._id),
                    message: 'Orders failed'
                });
            }

            
        }));

        // Clear cart after placing the order
        await Cart.findOneAndUpdate({ userId: userId }, { $set: { items: [] } });

        res.json({
            success: true,
            totalAmount: orders.map(order => order.finalAmount),
            orderIds: orders.map(order => order._id),
            message: 'Orders placed successfully'
        });

    } catch (error) {
        console.error('Error in placeOrder:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to place order'
        });
    }
};


 const getOrders = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const ordersPerPage = 10;
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * ordersPerPage;
        const returnPeriodDays = 7;

        const orders = await Order.aggregate([
            {
                $match: { userId: new mongoose.Types.ObjectId(userId) }
            },
            {
                $unwind: '$orderItems'
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'orderItems.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $unwind: '$productDetails'
            },
            {
                $project: {
                    productId: '$productDetails._id',
                    orderId: '$orderId',
                    productName: '$productDetails.productName',
                    finalAmount: '$finalAmount',
                    productImage: '$productDetails.productImage',
                    price: '$productDetails.salePrice',
                    quantity: '$orderItems.quantity',
                    status: '$orderItems.status',
                    size: '$orderItems.size',
                    color: '$orderItems.color',
                    createdOn: 1,
                    requestStatus:1,
                    returnReason:1,
                    orderGroupId: 1,
                    returnStatus: 1,
                    returnday: {  // no of days
                        $floor: {
                            $divide: [
                                { $subtract: [new Date(), '$createdOn'] },
                                1000 * 60 * 60 * 24
                            ]
                        }
                    },
                    isReturnable: {  // check weather lessthan  a week or not 
                        $lte: [
                            {
                                $divide: [
                                    { $subtract: [new Date(), '$createdOn'] },
                                    1000 * 60 * 60 * 24
                                ]
                            },
                            returnPeriodDays
                        ]
                    }
                }
            },
            {
                $sort: { createdOn: -1 }
            },
            {
                $skip: skip
            },
            {
                $limit: ordersPerPage
            }
        ]);



       console.log("order info = ",orders)
        // Get the total number of orders for the user (used for pagination)
        const totalOrders = await Order.countDocuments({ userId: new mongoose.Types.ObjectId(userId) });

        // Calculate total pages
        const totalPages = Math.ceil(totalOrders / ordersPerPage);

        // Get user details (optional, depending on your UI needs)
        const user = await User.findById(userId);

        // Render the orders page with pagination info
        res.render("orders", {
            orders: orders,
            user: user,
            currentPage: page,
            totalPages: totalPages,
            totalOrders: totalOrders,
            
        });

    } catch (error) {
        console.error("Error in getOrders:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};



const getOrderDetails = async (req, res) => {
    try {
        const orderId = req.params.id;
        console.log("Order ID:", orderId);

        const order = await Order.findOne({ orderId: orderId })
            .populate({
                path: "orderItems.product",
                select: "productName productImage price quantity",
            });

        if (!order) {
            return res.status(404).send("Order not found");
        }

        res.render("order-track", {
            order,
            title: "Order Details",
        });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Internal Server Error");
    }
};


const loadOrderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const orderId = req.query.orderId;

        const order = await Order.aggregate([
            {
                $match: { orderId: orderId, userId: userId } // Filter by orderId and userId
            },
            {
                $lookup: {
                    from: 'products', // The 'products' collection
                    localField: 'orderedItems.product', // Field from the Order model
                    foreignField: '_id', // Field in the Product model
                    as: 'orderedItems.product' // The resulting field with populated products
                }
            },
            {
                $unwind: {
                    path: '$orderedItems.product', // Unwind the array of orderedItems
                    preserveNullAndEmptyArrays: true // Preserve empty arrays (in case no match)
                }
            },
            {
                $project: {
                    orderId: 1,
                    userId:1,
                    status: 1,
                    orderedItems: 1,
                    shippingAddress: 1,
                    totalAmount: 1,
                    'orderedItems.product.productName': 1,
                    'orderedItems.product.productImage': 1,
                    'orderedItems.product.price': 1,
                }
            }
        ]);

        if (order.length === 0) {
           res.render("orders");
        }

        const user = await User.findById(userId);

        res.render("order-details", {
            order: order[0], // Return the first (and only) order
            user
        });

    } catch (error) {
        console.error("Error in loadOrderDetails:", error);
        res.status(500).send("Internal server error");
    }
};


const cancelOrder = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        console.log("orderId = ", orderId);
        console.log("reason =", reason);
        const userId = req.session.user._id;
        const usersId = new ObjectId(userId);

        // Fetch the order details using the orderId and userId
        const order = await Order.findOne({ orderId: orderId, userId: usersId });

        // Check if order exists
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        

        // If the order is neither cancelled nor delivered, cancel it
        if (order.status !== 'cancelled' && order.status !== 'delivered') {
            

            // Check if order has items
            if (!Array.isArray(order.orderItems) || order.orderItems.length === 0) {
                return res.status(400).json({ success: false, message: 'No items to cancel' });
            }
            const discount=order.discount||0
            // Calculate refund amount based on individual product prices
            let refundAmount = order.orderItems.reduce((total, item) => {
                const itemTotal = item.price * item.quantity;
                const discountAmount = (discount/ 100) * itemTotal;
                return total + (itemTotal - discountAmount);
            }, 0);

           

            console.log("Calculated refund amount:", refundAmount);

            // Step 1: Refund the amount to the user's wallet
            let user = await User.findById(userId);
            if (!user) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            user.wallet += refundAmount; // Add the refund amount to the user's wallet

            // Step 2: Update the user wallet balance
            await user.save();

            // Step 3: Create a refund transaction in the transaction collection
            const refundTransaction = new Transaction({
                userId: user._id,
                amount: refundAmount,
                transactionType: 'Refund',
                status: 'Success',
                description: `Order ${orderId} cancelled - Refund processed`
            });

            await refundTransaction.save();

            // Step 4: Update the order to 'cancelled' and apply the cancellation reason to the items
            const updateOrder = await Order.updateOne(
                { orderId: orderId, userId: userId },
                {
                    $set: {
                        status: 'cancelled',
                        cancelReason: reason,
                        'orderItems.$[].status': 'cancelled',
                        'orderItems.$[].cancelReason': reason
                    },
                  
                }
            );

            // Step 5: Update product stock for each item
            const productUpdates = order.orderItems.map(async (item) => {
                console.log(`Restocking product: ${item.product}, Quantity: ${item.quantity}`);

                const productUpdateResult = await Product.findByIdAndUpdate(
                    item.product,
                    { $inc: { quantity: item.quantity } }
                );

                if (!productUpdateResult) {
                    console.log(`Failed to update product: ${item.product}`);
                    throw new Error(`Failed to update product stock for ${item.product}`);
                }

                console.log(`Product ${item.product} stock updated successfully.`);
            });

            await Promise.all(productUpdates);

            return res.json({ 
                success: true, 
                message: 'Order cancelled and refund processed successfully',
                data: {
                    refundAmount,
                    cancelledItems: order.orderItems.length
                }
            });
        } else {
            return res.status(400).json({ 
                success: false, 
                message: 'Order cannot be cancelled as it is already ' + order.status
            });
        }

    } catch (error) {
        console.error('Error in cancelOrder:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
};
const failure = async (req, res) => {
    try {
      const { orderId, subtotal, addressId, couponCode, couponDiscount } = req.query;
      const userId = req.session.user._id;
  
      console.log('Payment Failure Info:', {
        orderId,
        subtotal,
        addressId,
        couponCode,
        couponDiscount
      });
  
      // Get selected address
      const address = await Address.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $unwind: "$address" },
        { $match: { "address._id": new mongoose.Types.ObjectId(addressId) } }
      ]);
  
      if (!address || address.length === 0) {
        console.log("Address not found");
        return res.status(404).json({ success: false, message: "Address not found" });
      }
  
      const selectedAddress = address[0].address;
  
      // Get cart items
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
          $lookup: {
            from: "categories",
            localField: "productDetails.category",
            foreignField: "_id",
            as: "categoryDetails"
          }
        },
        { $unwind: "$categoryDetails" },
        {
          $project: {
            productId: "$productDetails._id",
            productImage: "$productDetails.productImage",
            size: "$productDetails.size",
            color: "$productDetails.color",
            productName: "$productDetails.productName",
            salePrice: "$productDetails.salePrice",
            quantity: "$items.quantity",
            categoryOffer: "$categoryDetails.categoryOffer",
            productOffer: "$productDetails.productOffer"
          }
        }
      ]);
  
      if (!cart || cart.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
      }
  
      // Calculate total amount
      let totalAmount = 0;
      const shipping = 100;
  
      cart.forEach(item => {
        totalAmount += item.salePrice * item.quantity;
      });
  
      if (totalAmount < 5000) totalAmount += shipping;
      if (couponDiscount) totalAmount -= couponDiscount;
  
      totalAmount = Math.floor(totalAmount);
      console.log("Total:", totalAmount);
  
      // Create transaction record
      const transaction = new Transaction({
        userId,
        amount: totalAmount,
        transactionType: 'Razorpay',
        status: 'Failed',
        description: "Razorpay transaction failed"
      });
  
      await transaction.save();
  
      // Get discount info
      const discount = await Coupon.findOne({ name: couponCode });
  
      // Create order records
      const orderGroupId = generateOrderGroupId();
  
      const orders = await Promise.all(cart.map(item => {
        const order = new Order({
          orderItems: [{
            product: item.productId,
            OrderProductName: item.productName,
            orderProductImage: item.productImage[0],
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            price: item.salePrice,
            status: 'failed',
            requestStatus: 'pending',
          }],
          userId,
          totalPrice: item.salePrice * item.quantity,
          finalAmount: totalAmount,
          address: selectedAddress,
          discount: discount?.offerPrice || 0,
          status: 'failed',
          createdOn: new Date(),
          transactionId: transaction._id,
          orderGroupId
        });
  
        return order.save();
      }));
  
      // Clear cart
      await Cart.findOneAndUpdate({ userId }, { $set: { items: [] } });
  
      // Render failure page with retry data
    
      res.render("failure", {
        orderId,
        subtotal,
        addressId,
        couponCode,
        couponDiscount,
        totalAmount,
        orderGroupId
      });
  
    } catch (error) {
      console.error("Payment Failure Error:", error);
      res.status(500).render("error", { message: "An error occurred while processing the payment failure." });
    }
  };
  



const cancelgroup = async (req, res) => {
    try {
        const { orderGroupId, reason } = req.body;
        const userId = req.session.user._id;

        // Validation
        if (!orderGroupId || !reason) {
            return res.status(400).json({
                success: false,
                message: 'Order group ID and reason are required'
            });
        }

        // 1. Find all orders in the group
        const allOrders = await Order.find({
            orderGroupId,
            userId: new ObjectId(userId)
        }).lean();

        if (allOrders.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No orders found in this group'
            });
        }

        // 2. Filter cancellable orders
        const cancellableOrders = allOrders.filter(order => 
            ['pending', 'shipped'].includes(order.status)
        );

        if (cancellableOrders.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No cancellable orders in this group',
                data: {
                    orderStatuses: allOrders.map(o => o.status)
                }
            });
        }

        // 3. Calculate refund amount
        let refundAmount = cancellableOrders.reduce((total, order) => {
            if (order.status === 'pending' && order.transactionId && order.transactionId !== 'false') {
                return total + (order.totalAmount - (order.discount/100 * order.totalAmount));
            }
            return total;
        }, 0);

        // 4. Process refund if applicable
        if (refundAmount > 0) {
            try {
                // Create transaction record
                const transaction = await Transaction.create({
                    userId: userId,
                    amount: refundAmount,
                    transactionType: 'Refund',
                    status: 'Processing', // Start as Processing
                    description: `Refund for cancelled order group ${orderGroupId}`,
                    referenceId: orderGroupId,
                    createdAt: new Date()
                });

                // Update user wallet
                const updatedUser = await User.findByIdAndUpdate(
                    userId,
                    { $inc: { wallet: refundAmount } },
                    { new: true }
                );

                // Update transaction status to Success
                await Transaction.findByIdAndUpdate(transaction._id, {
                    status: 'Success',
                    updatedAt: new Date()
                });

                console.log(`Refund processed: ${refundAmount} added to user ${userId} wallet`);

            } catch (refundError) {
                console.error('Refund processing failed:', refundError);
                throw new Error('Failed to process refund transaction');
            }
        }

        // 5. Process order cancellations and product restocking
        const cancellationPromises = cancellableOrders.map(async (order) => {
            // Update order status
            await Order.updateOne(
                { _id: order._id },
                {
                    $set: {
                        status: 'cancelled',
                        cancelReason: reason,
                        cancelledAt: new Date(),
                        updatedAt: new Date()
                    },
                    $set: {
                        'orderItems.$[].status': 'cancelled',
                        'orderItems.$[].cancelReason': reason
                    }
                }
            );

            // Restock products
            await Promise.all(order.orderItems.map(item => {
                if (['pending', 'shipped'].includes(item.status)) {
                    return Product.findByIdAndUpdate(
                        item.product,
                        { $inc: { quantity: item.quantity } }
                    );
                }
                return Promise.resolve();
            }));
        });

        await Promise.all(cancellationPromises);

        // 6. Send success response
        return res.status(200).json({
            success: true,
            message: 'Order group cancellation processed successfully',
            data: {
                orderGroupId,
                totalOrders: allOrders.length,
                cancelledOrders: cancellableOrders.length,
                refundProcessed: refundAmount > 0,
                refundAmount: parseFloat(refundAmount.toFixed(2)),
                cancelledAt: new Date()
            }
        });

    } catch (error) {
        console.error('Order cancellation error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to process order cancellation',
            error: error.message,
            timestamp: new Date()
        });
    }
};

const requestReturn = async (req, res) => {

        try {
            const userId = req.session.user;
            const { orderId ,reason} = req.body;
        
            const order = await Order.findOne({ orderId: orderId });
        console.log("order foiund = ",order)
            if (!order) {
              return res.status(404).json({ success: false, message: 'Order not found.' });
            }
        
            if (order.returnStatus !== 'none') {
              return res.status(400).json({ success: false, message: 'Return already initiated.' });
            }
        
            // Just mark as requested — no refund here
            order.returnStatus = 'requested';
            order.returnReason
            await order.save();
        
            res.json({ success: true, message: 'Return request submitted. Waiting for admin approval.' });
        
          } catch (err) {
            console.error('Request return error:', err);
            res.status(500).json({ success: false, message: 'Server error.' });
          }
};


const success = async (req, res) => {
    try {
        const orderId = req.query.orderId;
        // const orderAmount =req.query.orderAmount

    //   console.log("orderid",orderId)
    //   console.log("total=",totalAmount)
           
            res.render("success");
   

        // Add any further order-related logic, like fetching order details from DB
        // Pass orderId to the view
    } catch (error) {
        console.error(error); // Log any error that occurs
        res.render("error");
    }
};
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

const razorpayPayment=async (req,res)=>{
    const { amount, userId, addressId ,couponDiscount ,couponvalue,couponCode} = req.body;
    // Convert amount to paise (RazorpayX works with paise, not rupees)
    const amountInPaise = amount * 100;

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
    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `order_rcptid_${new Date().getTime()}`,
      notes: {
        userId: userId,
        addressId: addressId,
        couponDiscount:couponDiscount,
        couponvalue:couponvalue,
        couponCode:couponCode
      },
    };
  
    razorpay.orders.create(options, (err, order) => {
      if (err) {
        return res.status(500).send({ success: false, message: 'Error creating order', error: err });
      }
      
      // Return the order ID and Razorpay Key to the frontend
      res.status(200).send({
        success: true,
        orderId: order.id,
        totalAount:amount,
        addressId: addressId,
        couponDiscount:couponDiscount,
        razorpayKey: process.env.RAZORPAY_KEY_ID,
      });
    });
}
const razorpayPaymentsuccess = async (req, res) => {
    console.log("here the Razorpay success is working");
    const { razorpayPaymentId, addressId, couponCode } = req.body;
    const userId = req.session.user._id;
  
    try {
      // 1. Verify payment with Razorpay
      const payment = await razorpay.payments.fetch(razorpayPaymentId);
      if (payment.status !== 'captured') {
        return res.status(400).json({ success: false, message: 'Payment verification failed' });
      }
  
      // 2. Get address details
      const address = await Address.aggregate([
        { $match: { userId: new mongoose.Types.ObjectId(userId) } },
        { $unwind: "$address" },
        { $match: { "address._id": new mongoose.Types.ObjectId(addressId) } }
      ]);
      if (!address || address.length === 0) {
        return res.status(400).json({ success: false, message: 'Address not found' });
      }
  
      const selectedAddress = address[0].address;
  
      // 3. Get cart items with product details
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
          $lookup: {
            from: "categories",
            localField: "productDetails.category",
            foreignField: "_id",
            as: "categoryDetails"
          }
        },
        { $unwind: "$categoryDetails" },
        {
          $project: {
            productId: "$productDetails._id",
            productImage: "$productDetails.productImage",
            size: "$productDetails.size",
            color: "$productDetails.color",
            productName: "$productDetails.productName",
            salePrice: "$productDetails.salePrice",
            quantity: "$items.quantity",
            categoryOffer: "$categoryDetails.categoryOffer",
            productOffer: "$productDetails.productOffer",
          }
        }
      ]);
  
      if (!cart || cart.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Cart is empty'
        });
      }
  
      // 4. Calculate total amount
      let totalAmount = 0;
      const shipping = 100;
  
      cart.forEach(item => {
        totalAmount += item.salePrice * item.quantity;
      });
  
      
  
      // 5. Calculate coupon discount
      let discountAmount = 0;
      if (couponCode) {
        const coupon = await Coupon.findOne({ name: couponCode });
        if (coupon && coupon.offerPrice) {
          discountAmount = coupon.offerPrice;
        }
      }
  
      totalAmount -= ((discountAmount/100)*totalAmount);
      
      if (totalAmount < 5000) {
        totalAmount += shipping;
      }
      totalAmount = Math.floor(totalAmount);
      console.log("Final Total:", totalAmount);
  
      // 6. Create transaction record
      const transaction = new Transaction({
        userId: userId,
        amount: totalAmount,
        transactionType: 'Razorpay',
        status: 'Success',
        description: "Razorpay transaction is successful"
      });
      await transaction.save();
  
      // 7. Generate order group ID
      const orderGroupId = generateOrderGroupId();
  
      // 8. Create orders
      const orders = await Promise.all(cart.map(async (item) => {
        const order = new Order({
          orderItems: [{
            product: item.productId,
            OrderProductName: item.productName,
            orderProductImage: item.productImage[0],
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            price: item.salePrice,
            status: 'pending',
            requestStatus: 'pending',
          }],
          userId: userId,
          totalPrice: item.salePrice * item.quantity,
          finalAmount: totalAmount,
          address: selectedAddress,
          discount: discountAmount,
          status: 'pending',
          createdOn: new Date(),
          transactionId: transaction._id,
          orderGroupId: orderGroupId
        });
  
        // Update product stock
        await Product.findByIdAndUpdate(item.productId, {
          $inc: { quantity: -item.quantity }
        });
  
        return order.save();
      }));
  
      // 9. Clear cart
      await Cart.findOneAndUpdate({ userId: userId }, { $set: { items: [] } });
  
      // 10. Send response
      res.status(200).json({
        success: true,
        orderGroupId: orderGroupId
      });
  
    } catch (error) {
      console.error('Error processing Razorpay payment:', error);
      res.status(500).json({
        success: false,
        message: 'Error processing payment',
        error: error.message
      });
    }
  };
  

  const generateOrderGroupId = () => {
    return `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  };
  
  const invoiceDownload = async (req, res) => {
    try {
        const { orderId } = req.query;
        if (!orderId) return res.status(400).send('Missing order ID');

        const order = await Order.findOne({ orderId: orderId })
        .populate({
            path: 'orderItems.product',
            select: 'productName productImage regularPrice salePrice' // Only get these fields
          })

         

        const doc = new PDFDocument({ margin: 40, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=Invoice-${orderId}.pdf`);
        doc.pipe(res);

        // Header Section
        doc.fontSize(20).text('INVOICE', { align: 'center' }).moveDown();

        // Company Info
        doc.fontSize(10)
            .text('STYLE TRIBE', { align: 'center' })
            .text('Near Highway 66,Kinfra 3rd floor,Kakkanchery,Malapuram,676767', { align: 'center' })
            .moveDown(2);

        // Order Metadata with proper spacing
        let yPosition = 140;
        doc.fontSize(10)
            .text(`Order ID: ${order.orderId}`, 50, yPosition)
            .text(`Date: ${order.createdOn.toLocaleDateString()}`, 50, yPosition + 20)
            .text(`User ID: ${order.userId}`, 50, yPosition + 40);

        // Billing Address
        const billing = order.shippingAddress || {};
        doc.fontSize(10)
            .text(`Bill Address: ${order.address.name }
                    ${order.address.landMark },
                    ${order.address.streetAddress },${order.address.city }
                    ${order.address.state },${order.address.country }
                    ${order.address.state },pin: ${order.address.pincode }
                    phone: ${order.address.phone }`, 330, yPosition)
           
          

        // Table Header with column widths
        yPosition += 100;
        const colPositions = {
            number: 50,
            name: 100,
            qty: 200,
            type:300,
            price: 400,
            total: 500
        };
// Draw a rectangle around the entire page
doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
   .stroke(); // Use .fill() for filled rectangle
   
        doc.font('Helvetica-Bold')
            .fontSize(10)
            .text('No.', colPositions.number, yPosition)
            .text('Item Name', colPositions.name, yPosition)
            .text('Qty', colPositions.qty, yPosition)
            .text('type', colPositions.type, yPosition)
            .text('Unit Price', colPositions.price, yPosition, { width: 80, align: 'right' })
            .text('Total', colPositions.total, yPosition, { width: 60, align: 'right' });

        // Table Rows
        yPosition += 20;
        let price=0
        let ref=0
        let total =0
        order.orderItems.forEach((item, index) => {
            const rowY = yPosition + (index * 30);
            ref=((item.quantity || 0) * (item.price || 0))
            total = ref-((order.discount/100)*ref);
            price=item.price*item.quantity
            doc.font('Helvetica')
                .fontSize(10)
                .text(`${index + 1}.`, colPositions.number, rowY)
                .text(
                    order.orderItems[0].product.productName || 'Unnamed Product', 
                    colPositions.name, 
                    rowY, 
                    {
                      width: 90,              // Maximum width before breaking
                      lineBreak: true,         // Enable line breaking
                      ellipsis: true,          // Add "..." if truncated (optional)
                      height: 40,              // Maximum height for wrapped text
                      lineGap: 5               // Spacing between broken lines
                    }
                  )
                .text(String(item.quantity || 0), colPositions.qty, rowY)
                .text(String(order.status || 0), colPositions.type, rowY)
                .text(`₹${ref.toFixed(2)}`, colPositions.price, rowY, { width: 80, align: 'right' })
                .text(`₹${(total || 0).toFixed(2)}`, colPositions.total, rowY, { width: 60, align: 'right' });
        });

        // Totals Section
        yPosition += (order.orderItems.length * 30) + 30;
        doc.font('Helvetica-Bold')
            .text('Subtotal:', colPositions.price, yPosition, { width: 80, align: 'right' })
            .text(`₹${(price|| 0).toFixed(2)}`, colPositions.total, yPosition, { width: 60, align: 'right' })
            .text('Discount:', colPositions.price, yPosition + 20, { width: 80, align: 'right' })
            .text(`-₹${(order.discount || 0).toFixed(2)}`, colPositions.total, yPosition + 20, { width: 60, align: 'right' })
            .text('Grand Total:', colPositions.price, yPosition + 40, { width: 80, align: 'right' })
            .text(`₹${(total|| 0).toFixed(2)}`, colPositions.total, yPosition + 40, { width: 60, align: 'right' });

        doc.end();
    } catch (error) {
        console.error('Invoice Error:', error);
        res.status(500).send('Failed to generate invoice');
    }
};

const rate = async (req, res) => {
    const { productId, stars, message } = req.body;
    const userId = req.session.user._id;
  
    console.log("Received:", { productId, stars, message });
  
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ success: false, message: 'Invalid product ID' });
    }
  
    try {
      const product = await Product.findById(productId);
      if (!product) return res.status(404).json({ success: false, message: 'Product not found' });
  
      const alreadyRated = product.ratings.find(r => r.user.toString() === userId.toString());
      if (alreadyRated) {
        return res.status(400).json({ success: false, message: 'You have already rated this product.' });
      }
  
      product.ratings.push({ user: userId, stars, message });
  
      const totalStars = product.ratings.reduce((acc, r) => acc + r.stars, 0);
      const avg = totalStars / product.ratings.length;
      product.ratting = avg.toFixed(1);
  
      await product.save();
  
      res.json({ success: true, message: 'Review submitted successfully.' });
    } catch (err) {
      console.error('Rating Error:', err);
      res.status(500).json({ success: false, message: 'Internal server error.' });
    }
  };
  const returnRequestStatus=async(req,res)=>{

        try {
            const { orderId } = req.params;
    
            const order = await Order.findOne({ orderId });
    
            if (!order) return res.json({ success: false, message: 'Order not found' });
    
            // Find the rejected item and get its admin message
            const rejectedItem = order.orderItems.find(item => item.requestStatus === 'rejected');
    
            if (!rejectedItem || !rejectedItem.adminMessage) {
                return res.json({ success: false, message: 'No rejection reason found' });
            }
    
            res.json({
                success: true,
                messageFromBackend: rejectedItem.adminMessage
            });
        } catch (err) {
            console.error('Error fetching rejection reason:', err);
            res.status(500).json({ success: false, message: 'Server error' });
        }
}
// Define the route in your backend (e.g., Express.js)

const retryPayment = async (req, res) => {
    const { orderId } = req.params;  // Access orderId from URL parameters
    console.log("order id =", orderId);

    try {
        const [order] = await Order.find({ orderId: orderId, status: 'failed' });
console.log("failed order = ",order)

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        if (order.status !== 'failed') {
            return res.status(400).json({
                success: false,
                message: "This order cannot be retried as it is not in a failed state."
            });
        }

        const { finalAmount, userId, address,discount } = order;

console.log( finalAmount, userId, address, discount)
const razorpayOrderData = {
    amount: finalAmount * 100,
    currency: 'INR',
    receipt: `order-${new Date().getTime()}`, // Generate a unique receipt ID based on current timestamp
    payment_capture: 1, // Auto capture after successful payment
};


        const razorpayOrder = await razorpay.orders.create(razorpayOrderData);

        if (razorpayOrder) {
            return res.status(200).json({
                success: true,
                razorpayOrderId: razorpayOrder.id,
                razorpayKey: process.env.RAZORPAY_KEY_ID,
                userId: userId,
                address: address,
                couponDiscount: discount || 0,
                finalAmount:finalAmount || 0,
                orderId:orderId
               
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Error creating Razorpay order'
            });
        }
    } catch (error) {
        console.error('Error in retrying payment:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
};


const verifypayment=async(req,res)=>{
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, orderId ,finalAmount} = req.body;

    console.log("Internal orderId:", orderId);
   


const userId=req.session.user._id
    // Fetch the orders where the userId matches and have 'failed' status
    const failedOrders = await Order.find({ orderId: orderId, status: 'failed' });
    if (failedOrders.length > 0) {
        // Loop through the failed orders and update their status to 'pending'
        for (let order of failedOrders) {
            // Update the status of orderItems if it's an array
            if (Array.isArray(order.orderItems)) {
                for (let item of order.orderItems) {
                    // Assuming each orderItem has a `status` field
                    item.status = 'pending';  // Update item status to 'pending'
                }
            }
            
            // Update the overall order status to 'pending'
            order.status = 'pending';
            
            // Save the updated order back to the database
            await order.save();
        }
        // 6. Create transaction record
    
        const transaction = new Transaction({
            userId: userId,
            amount: finalAmount,
            transactionType: 'Razorpay',
            status: 'Success',
            description: "Razorpay transaction is successful"
          });
          await transaction.save();
    
      // Send a success response to the frontend
      res.json({ success: true, message: 'All failed orders and their items have been updated to pending.' });
    } else {
     
    
        // Send a failure response to the frontend if no failed orders are found
        res.json({ success: false, message: 'No failed orders found for this user.' });
    }
    
    

}
module.exports = {
    placeOrder,
    getOrders,
    loadOrderDetails,
    cancelOrder,
    success,
    razorpayPayment,
 razorpayPaymentsuccess,
 cancelgroup, invoiceDownload,
 getWalletBalance,
 requestReturn,
 rate,
 failure,
 returnRequestStatus,
 getOrderDetails,
retryPayment,
verifypayment

};