const mongoose = require('mongoose');
const {Schema} = mongoose;
const {v4: uuidv4} = require('uuid');

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: () => uuidv4(),
        unique: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    orderItems: [{
        product: {
            type: Schema.Types.ObjectId,
            ref: 'Product',
            required: true
        },
        OrderProductName:{
            type:String,
            

        },
        orderProductImage:{
            type: [String]

        },
        size:{
            type:String,
         
        },
        color:{
            type:String,

            
        },
        quantity: {
            type: Number,
            required: true
        },
        price: {
            type: Number,
            default: 0
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returning', 'returned'],
            default: 'pending'
        },
        cancelReason: {
            type: String
        },
        returnReason: {
            type: String
        },
        requestStatus: {
            type: String,
            enum: ['pending', 'approved', 'rejected'],
            default: 'pending'
        },
        adminMessage: {
            type: String
        }
    }],
    totalPrice: {
        type: Number,
        required: true
    },
    discount: {
        type: Number,
        default: 0
    },
    finalAmount: {
        type: Number,
        required: true
    },
    address: {
        type: Schema.Types.Mixed,
        required: true
    },
    invoiceDate: {
        type: Date
    },
    status: {
        type: String,
        required: true,
        enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returning', 'returned'],
        default: 'pending'
    },
    cancelReason: {
        type: String
    },
    returnReason: {
        type: String
    },
    requestStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    adminMessage: {
        type: String
    },
    createdOn: {
        type: Date,
        default: Date.now,
        required: true
    },
    couponApplied: {
        type: Boolean,
        default: false
    },
    transactionId:{
        type: String,
        default: false
    },
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;