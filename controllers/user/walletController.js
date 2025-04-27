const Razorpay = require('razorpay');
const crypto = require('crypto');
const Transaction = require("../../models/transactionSchema");
const User = require("../../models/userSchema");
const mongoose = require('mongoose');

const dCoupon =require("../../models/dcouponSchema");
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.createRazorpayOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        
        // Validate amount (minimum ₹1 = 100 paise)
        if (!amount || isNaN(amount) || amount < 100) {
            return res.status(400).json({
                success: false,
                message: 'Amount must be at least ₹1 (100 paise)'
            });
        }

        const receiptId = `wlt${Date.now().toString().slice(-9)}`;

        const options = {
            amount: Math.round(amount),
            currency: "INR",
            receipt: receiptId,
            payment_capture: 1,
            notes: {
                userId: req.session.user._id.toString(),
                purpose: "wallet_topup"
            }
        };
        
        const order = await razorpay.orders.create(options);
        
        // Create transaction record using your exact schema
        const transaction = new Transaction({
            userId: req.session.user._id,
            amount: amount , // Store in rupees
            transactionType: 'Razorpay', // Using your enum value
            status: 'pending', // As per your schema which only allows Success/Failed
            description: `Wallet top-up initiated. Order ID: ${order.id}`,
            date: new Date() // Explicitly setting date as per your schema
        });

        await transaction.save();

        res.json({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
                receipt: order.receipt
            },
            transactionId: transaction._id
        });

    } catch (error) {
        console.error('Razorpay order creation error:', error.error || error);
        res.status(500).json({
            success: false,
            message: error.error?.description || 'Payment initialization failed'
        });
    }
};


exports.verifyPayment = async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount, transactionId } = req.body;
  try {
    const userId = req.session.user._id;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !amount || !transactionId) {
      throw new Error('Missing required verification data');
    }

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      throw new Error('Payment verification failed: Invalid signature');
    }
    
    // Update transaction
    const updatedTransaction = await Transaction.findByIdAndUpdate(
      transactionId,
      {
        status: 'Success',
        description: `Wallet top-up completed. Payment ID: ${razorpay_payment_id}`,
        date: new Date()
      },
      { new: true }
    );

    if (!updatedTransaction) {
      throw new Error('Transaction record not found');
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    // 3. Find user with proper ID type
    const user = await User.findOne({ _id: userObjectId });
    if (!user) {
      throw new Error('User not found');
    }

    // Update user wallet
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $inc: { wallet: parseFloat(amount) } },
      { new: true }
    );

    res.json({
      success: true,
      message: 'Payment verified and wallet updated',
      walletBalance: updatedUser.wallet,
      transaction: updatedTransaction
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    
    // Update transaction as failed if verification fails
    if (transactionId) {
      await Transaction.findByIdAndUpdate(transactionId, {
        status: 'Failed',
        description: `Payment verification failed: ${error.message}`,
        date: new Date()
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Payment verification failed'
    });
  }
};


// walletController.js

exports.createWithdrawalOrder = async (req, res) => {
  try {
    const { amount } = req.body; // in paise
    const userId = req.session.user._id;

    // Validate amount (minimum ₹1 = 100 paise)
    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum withdrawal amount is ₹1 (100 paise)'
      });
    }

    // Check user balance
    const user = await User.findById(userId);
    if (user.wallet < (amount / 100)) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    // Create Razorpay order for withdrawal
    const receiptId = `wdrw-${Date.now().toString().slice(-6)}`;
    const order = await razorpay.orders.create({
      amount: Math.round(amount),
      currency: "INR",
      receipt: receiptId,
      payment_capture: 1,
      notes: {
        userId: userId.toString(),
        purpose: "wallet_withdrawal"
      }
    });

    // Create transaction record
    const transaction = new Transaction({
      userId:userId,
      amount: amount / 100, // Store in rupees
      transactionType: 'Debit',
      status: 'pending',
 
    
      description: 'Withdrawal initialization'
    });
    await transaction.save();

    res.json({
      success: true,
      order: {
        id: order.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt
      },
      transactionId: transaction._id
    });

  } catch (error) {
    console.error('Withdrawal order error:', error);
    res.status(500).json({
      success: false,
      message: error.error?.description || 'Withdrawal initialization failed'
    });
  }
};

exports.verifyWithdrawal = async (req, res) => {
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature, amount, transactionId } = req.body;
  const userId = req.session.user._id;
  try {
   

    // Verify signature
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generatedSignature !== razorpay_signature) {
      throw new Error('Withdrawal verification failed: Invalid signature');
    }

    // Update transaction
    const transaction = await Transaction.findByIdAndUpdate(
      transactionId,
      {
        status: 'Success',
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        description: 'Withdrawal completed'
      },
      { new: true }
    );

    // Deduct from wallet
    await User.findByIdAndUpdate(
      userId,
      { $inc: { wallet: -parseFloat(amount) } }
    );

    res.json({
      success: true,
      message: 'Withdrawal verified and processed',
      amount: amount
    });

  } catch (error) {
    console.error('Withdrawal verification error:', error);
    
    // Mark transaction as failed if verification fails
    if (transactionId) {
      await Transaction.findByIdAndUpdate(transactionId, {
        status: 'Failed',
        description: `Withdrawal failed: ${error.message}`
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Withdrawal verification failed'
    });
  }
};

exports.addPromoCode = async (req, res) => {
  try {
    const { promoCode } = req.body;
    const code = promoCode?.toString().trim(); // Clean the promo code
    console.log("Referral Code =", code);

    // Find the coupon by its code
    const validCoupon = await dCoupon.findOne({ code });

    if (!validCoupon) {
      return res.status(404).json({ success: false, message: "Invalid or expired promo code" });
    }

    if (validCoupon.isUsed) {
      return res.status(400).json({ success: false, message: "This promo code has already been used" });
    }

    // Find the owner of the coupon
    const userDetail = await User.findById(validCoupon.owner);

    if (!userDetail) {
      return res.status(404).json({ success: false, message: "User not found for this promo code" });
    }

    // Add discount to user's wallet
    userDetail.wallet += validCoupon.discountAmount;
    await userDetail.save();

    // Mark the coupon as used
    validCoupon.isUsed = true;
    await validCoupon.save();

    const transaction = new Transaction({
      userId: userDetail._id,
      amount: validCoupon.discountAmount,
      transactionType: 'Credit',
      status: 'Success',
      description: `Wallet payment of ₹${validCoupon.discountAmount} for order placement`
    });
    await transaction.save();

    return res.render('walletAmount',{
      success: true,
      message: `₹${validCoupon.discountAmount} added to ${userDetail.fullname}'s wallet`,
      walletBalance: userDetail.wallet,
    });

  } catch (error) {
    console.error("Error checking referral code:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
