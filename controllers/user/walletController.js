// server/controllers/walletController.js
const User = require("../../models/userSchema"); // Import the User model
const Cart=require("../../models/cartSchema");
// Add funds to wallet
const addFunds = async (req, res) => {
  const { amount } = req.body;
  const userId = req.session.user._id;
  // Ensure the amount is positive
  if (amount <= 0) return res.status(400).send("Amount must be positive.");

  try {
    // Find user by userId
    let user = await User.findById(userId);

    if (!user) {
      return res.status(404).send("User not found.");
    }

    // Add funds to the user's wallet

    user.wallet = Number(user.wallet) + Number(amount);
    await user.save();

    res.redirect("/wallet");  // Redirect after adding funds
  } catch (error) {
    res.status(500).send("Server error.");
  }
};

// Withdraw funds from wallet
const withdrawFunds = async (req, res) => {
  const { amount } = req.body;
  const userId = req.session.user._id;
  // Ensure the amount is positive
  if (amount <= 0) return res.status(400).send("Amount must be positive.");

  try {
    // Find user by userId
    let user = await User.findById(userId);

    if (!user) return res.status(404).send("User not found.");

    // Check if user has enough funds
    if (user.wallet < amount) {
      return res.status(400).send("Insufficient funds.");
    }

    // Withdraw funds from the user's wallet
    user.wallet -= Number(amount);  // Ensure amount is treated as a number
    await user.save();

    res.redirect("/wallet");  // Redirect after withdrawal
  } catch (error) {
    res.status(500).send("Server error.");
  }
};

// Purchase with wallet funds
const purchaseWithWallet = async (req, res) => {
  const {  amount } = req.body;
  const userId = req.session.user._id;
  // Ensure the amount is positive
  if (amount <= 0) return res.status(400).send("Amount must be positive.");

  try {
    // Find user by userId
    let user = await User.findById(userId);

    if (!user) return res.status(404).send("User not found.");

    // Check if user has enough funds
    if (user.wallet < amount) {
      return res.status(400).send("Insufficient funds.");
    }

    // Deduct the purchase amount from the user's wallet
    user.wallet -= Number(amount);  // Ensure amount is treated as a number
    await user.save();

    res.redirect("/wallet");  // Redirect after purchase
  } catch (error) {
    res.status(500).send("Server error.");
  }
};

module.exports = {
  addFunds,
  withdrawFunds,
  purchaseWithWallet
};
