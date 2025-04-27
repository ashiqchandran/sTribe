const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: 'Category',
        required: true
    },
    size: { type: String},
    
    color: { type: String},
    regularPrice: {
        type: Number,
        required: true
    },
    salePrice: {
        type: Number,
        required: true
    },
    quantity: {
        type: Number,
        required: true
    },
    
      variants: [{
        
        size: { type: String, required: true },
        color: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, required: false },
      }
      ],
    productImage: {
        type: [String],
        required: true,
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    brand:{
        type:String,
        required:true,
        default:"Diesel,"
      },
    status: {
        type: String,
        enum: ['available', 'out of stock', 'discontinued'],
        required: true,
        default: 'available'
    },
    productOffer : {
        type:Number,
        default:0
      },
      bestOffer: { type: Number, default: 0 },
      ratings: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
           
          },
          stars: {
            type: Number,
            min: 1,
            max: 5,
            default:0
          },
          message: {
            type: String,
            maxlength: 500
          },
          createdAt: {
            type: Date,
            default: Date.now
          }
        }
      ]
      
      
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
