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
    size:{
        type:String,
        default:"M",
      },
      color:{
        type:String,
        default:"blue",
        required:true,
      },
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
    }
}, { timestamps: true });

const Product = mongoose.model('Product', productSchema);
module.exports = Product;
