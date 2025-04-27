const mongoose = require('mongoose');
const { Schema } = mongoose;

const referralCouponSchema = new Schema({
  code: { type: String, unique: true }, // Unique code for the referral coupon
  discountAmount: { type: Number, default: 50 }, // The amount for the coupon
  validUntil: { type: Date, default: Date.now() + 30 * 24 * 60 * 60 * 1000 }, // Default validity for 30 days
  owner: { type: Schema.Types.ObjectId, ref: 'User' } ,// The referrer user who gets this coupon
  isUsed:{type:Boolean,default:false}
});

// Check if the model already exists before defining it with a different name (ReferralCoupon)
const ReferralCoupon = mongoose.models.ReferralCoupon || mongoose.model('ReferralCoupon', referralCouponSchema);

module.exports = ReferralCoupon;
