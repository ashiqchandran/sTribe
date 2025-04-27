// server/models/transactionSchema.js
const mongoose = require('mongoose');
const {v4: uuidv4} = require('uuid');

const transactionSchema = new mongoose.Schema({
 
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  transactionType: { type: String, enum: ['Wallet', 'Refund' ,'Razorpay','Credit', 'Debit'], required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['Success', 'Failed','pending'], required: true },
  description : {    type:String,     required:true   },


  
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
