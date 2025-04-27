const Contact = require("../../models/contactSchema")

const mongoose = require('mongoose');


const getContactPage=(req,res)=>{
try {
    res.render("contacts")
} catch (error) {
    res.render(error)
}
}


const submitContactForm = async (req, res) => {
    try {
      const { name, email, message } = req.body;
  
      if (!name || !email || !message) {
        return res.status(400).send("All fields are required.");
      }
  
      const contactEntry = new Contact({
        name,
        email,
        message
      });
  
      await contactEntry.save();
     res.render('infosend')
    } catch (error) {
      console.error("Error submitting contact form:", error);
      res.status(500).send("Something went wrong. Please try again later.");
    }
  };
  
module.exports={
    getContactPage,
    submitContactForm
}





