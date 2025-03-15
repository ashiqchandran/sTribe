const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Cart=require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const mongoose = require('mongoose');

const placeOrder = async (req, res) => {
    try {
        console.log("Received placeOrder request");
        const userId = req.session.user._id;
        console.log("user id = ",userId)
        const { addressId } = req.body;
        console.log("address id = ",addressId)
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
                    productName: "$productDetails.productName",
                    salePrice: "$productDetails.salePrice",
                    quantity: "$items.quantity"
                }
            }
        ]);
        console.log("placeorder aggregate is working")
console.log("cart=",cart    )
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
                    quantity: item.quantity,
                    price: item.salePrice,
                    status: 'pending'
                }],
                userId: userId,
                totalPrice: item.salePrice * item.quantity,
                finalAmount: item.salePrice * item.quantity,
                address: selectedAddress,
                status: 'pending',
                createdOn: new Date()
            });

            // Update the product quantity
            await Product.findByIdAndUpdate(item.productId, {
                $inc: { quantity: -item.quantity }
            });

            return order.save();
        }));
console.log("cart = ",cart)
        // Clear cart after placing the order
        // await Cart.findOneAndUpdate({ userId: userId }, { $set: { items: [] } });

        res.json({
            success: true,
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

        const orders = await Order.aggregate([
            {
                $match: { userId: new mongoose.Types.ObjectId(userId) }  // Match orders by userId
            },
            {
                $lookup: {  // Join with the `products` collection
                    from: 'products',
                    localField: 'orderItems.product',  // Join on the `product` field inside `orderItems`
                    foreignField: '_id',  // Match with `_id` of the `Product` collection
                    as: 'productDetails'  // Store result in `productDetails`
                }
            },
            {
                $unwind: '$orderItems'  // Unwind the orderItems array to treat each item individually
            },
            {
                $unwind: '$productDetails'  // Unwind the `productDetails` array
            },
            {
                $project: {  // Include only the necessary fields
                    _id: 0,
                    orderId: '$orderId',
                    productName: '$productDetails.productName',
                    finalAmount: '$finalAmount',
                    productImage: '$productDetails.productImage',
                    price: '$productDetails.salePrice',
                    quantity: '$orderItems.quantity',
                    status: '$orderItems.status',
                    createdOn: 1  // Include order creation date
                }
            },
            {
                $sort: { createdOn: -1 }  // Sort by order creation date in descending order
            }
        ]);

        // Get user details
        const user = await User.findById(userId);

        res.render("orders", {
            orders: orders,
            user: user
        });

    } catch (error) {
        console.error("Error in getOrders:", error);
        res.status(500).json({ error: "Internal server error" });
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

        // Fetch the order details using the orderId and userId
        const order = await Order.findOne({ orderId: orderId, userId: userId });

        // Check if order exists
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        console.log("Order found:", order); // Check if order exists and contains orderItems

        // If the order is neither cancelled nor delivered, cancel it
        if (order.status !== 'cancelled' && order.status !== 'delivered') {
            console.log("Cancelling order: ", orderId);

            // Update the order status to 'cancelled' and apply the cancellation reason to the items
            const updateOrder = await Order.updateOne(
                { orderId: orderId, userId: userId },
                {
                    $set: {
                        status: 'cancelled',
                        cancelReason: reason,
                        'orderItems.$[].status': 'cancelled',  // Using $[] to update all items in the array
                        'orderItems.$[].cancelReason': reason  // Apply reason to all items
                    },
                    $inc: { 
                        'orderItems.$[].quantity': 1 // Restock all items
                    }
                }
            );

            console.log("Order updated successfully:", updateOrder);

            // Ensure that orderItems exists and is an array
            if (!Array.isArray(order.orderItems) || order.orderItems.length === 0) {
                return res.status(400).json({ success: false, message: 'No items to cancel' });
            }

            // Loop through each order item and update product stock
            const productUpdates = order.orderItems.map(async (item) => {
                console.log(`Restocking product: ${item.product}, Quantity: ${item.quantity}`);

                // Find the product and update stock
                const productUpdateResult = await Product.findByIdAndUpdate(item.product, {
                    $inc: { quantity: item.quantity } // Increase stock by item quantity
                });

                if (!productUpdateResult) {
                    console.log(`Failed to update product: ${item.product}`);
                    throw new Error(`Failed to update product stock for ${item.product}`);
                }

                console.log(`Product ${item.product} stock updated successfully.`);
            });

            // Wait for all product stock updates to complete
            await Promise.all(productUpdates);

            return res.json({ success: true, message: 'Order cancelled successfully' });
        } else {
            return res.status(400).json({ success: false, message: 'Order cannot be cancelled' });
        }

    } catch (error) {
        console.error('Error in cancelOrder:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};



module.exports = {
    placeOrder,
    getOrders,
    loadOrderDetails,
    cancelOrder
};