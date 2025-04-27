const { defaultMaxListeners } = require('connect-mongo');
const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    userImage:{
        type: [String]

    },
    fullname: {
        type: String,
        required: true
    },
    username: {
        type: String,
        
        required: false
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    phone: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
        default: null
    },
    googleId: {
        type: String,
        unique: false,
        sparse: true
    },
    password: {
        type: String,
        required: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    isAdmin: {
        type: Boolean,
        default: false
    },
    cart:[{
        productId: {
            type: Schema.Types.ObjectId,
            ref: 'Product'
        },
        quantity: {
            type: Number,
            default: 1
        }
    }],
    wallet: {
        type: Number,
        default: 0,
    },
    wishlist: [{
        type: Schema.Types.ObjectId,
        ref: "Wishlist"
    }],
    orderHistory: [{
        type: Schema.Types.ObjectId,
        ref: "Order"
    }],
    createdOn: {
        type: Date,
        default: Date.now
    },
 
    searchHistory: [{
        category: {
            type: Schema.Types.ObjectId,
            ref: "Category",
        },
        brand: {
            type: String
        },
        SearchOn: {
            type: Date,
            default: Date.now
        }
    }]
    ,
    image:{
        type:[String],
        // required:true
      },
      referralCode: { type: String, required: true, unique: true },
     referalPoint:{
        type:Number,
        default:0
     },
     coupons: [{ type: Schema.Types.ObjectId, ref: 'Coupon' }],
     referredBy: { type: String, default: null },
     
     bankAccount: {
        name: String,
        accountNumber: String,
        ifsc: String,
        verified: Boolean
      }
   
});

const User = mongoose.model("User", userSchema);
module.exports = User;
