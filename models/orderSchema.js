const mongoose=require("mongoose");
const {v4:uuidv4} =  require('uuid');

const {Schema} =  mongoose;

const orderSchema = new Schema({
orderId:{
    type:String,
    default:()=>uuidv4(),
    unique:true
},

userId:{
    type:Schema.Types.ObjectId,
        ref:'user',
        required:true
},

orderItems:[{
    product:{
        type:Schema.Types.ObjectId,
        ref:'product',
        required:true
    },
    quantity:{
        type:Number,
        required:true
    },price:{
        type:Number,
        default:0
    },
    status:{
        type:String,
        default:"pending"
    }

}],
totalPrice:{
    type:Number,
    required:true
},discount:{
    type:String,
    default:0
},
finalAmount:{
    type:Number,
    required:true
},
address:{
    type:Schema.Types.ObjectId,
    ref:'User',
    required:true
},
invoiceDate:{
    type:Date
},
status:{
    type:String,
    required:true,
    enum:['pending','processing','shipped','Delivered','canclled','Return Request','Returned'],

},
createdOn:{
    type:Date,
    default:Date.now,
    requestd:true
},
couponApplied:{
    type:Boolean,
    default:false

}

})

const Order=mongoose.model("Order",orderSchema)
module.exports=Order