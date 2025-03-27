// server/models/transactionSchema.js
const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  amount: { type: Number, required: true },
  transactionType: { type: String, enum: ['payment', 'refund'], required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['success', 'failed'], required: true },
  // Additional fields (e.g., order details) can be added if necessary
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
