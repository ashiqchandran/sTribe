const Order = require("../../models/orderSchema");
const User = require("../../models/userSchema");
const Cart=require("../../models/cartSchema");
const Product = require("../../models/productSchema");
const Address = require("../../models/addressSchema");
const mongoose = require('mongoose');

const placeOrder = async (req, res) => {
    try {
        console.log("Received placeOrder request");
        const userId = req.session.user;
        const { addressId } = req.body;

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
                    productId: "$productDetails._id",
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
                userId: userId,
                orderedItems: [{
                    product: item.productId,
                    quantity: item.quantity,
                    price: item.salePrice,
                    status: 'pending'
                }],
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
        const user = req.session.user;
        if (!user || !user._id) {
            return res.status(400).send("User not logged in");
        }
        const userId = new mongoose.Types.ObjectId(user._id);

        // Aggregate orders with populated fields
        console.log("User  session:", req.session.user);
        console.log("User  ID:", userId);
        db.orders.find({ userId: ObjectId("your_user_id_here") });
        const orders = await Order.aggregate([
            { $match: { userId } }
        ]);
        console.log("Order items:", orders.map(order => order.orderItems));
        console.error("Error in getOrders:", error.message);

        res.render("orders", { success: true, orders });

    } catch (error) {
        console.error("Error in getOrders:", error);
        res.status(500).render("orders", { success: false, orders: [], message: "Internal server error" });
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
        const userId = req.session.user;

        const order = await Order.aggregate([
            {
                $match: { _id: new mongoose.Types.ObjectId(orderId), userId: userId }
            },
            {
                $unwind: '$orderedItems'
            },
            {
                $project: {
                    orderId: 1,
                    status: 1,
                    orderedItems: 1,
                    cancelReason: 1
                }
            }
        ]);

        if (order.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const currentOrder = order[0];

        if (currentOrder.status !== 'cancelled' && currentOrder.status !== 'delivered') {
            // Update the order status to 'cancelled'
            const updateOrder = await Order.updateOne(
                { _id: new mongoose.Types.ObjectId(orderId), userId: userId },
                {
                    $set: { 
                        status: 'cancelled',
                        cancelReason: reason,
                        'orderedItems.$[item].status': 'cancelled',
                        'orderedItems.$[item].cancelReason': reason
                    },
                    $inc: { 
                        'orderedItems.$[item].quantity': 1 // Increase the product quantity by 1 (restocking)
                    }
                },
                {
                    arrayFilters: [{ 'item.product': currentOrder.orderedItems.product }],
                    new: true
                }
            );

            // Return product quantity to stock
            await Product.findByIdAndUpdate(currentOrder.orderedItems.product, {
                $inc: { quantity: currentOrder.orderedItems.quantity }
            });

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