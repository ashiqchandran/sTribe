const EventEmitter = require("events")
const userBlockedEmitter = new EventEmitter()

const User = require("../../models/userSchema");
const Contact = require("../../models/contactSchema");

const customerInfo = async (req, res) => {
    try {
        let search=''
        if(req.query.search){
            search = req.query.search
        }
        let page=1
        if(req.query.page){
            page = req.query.page
        }
        const limit = 9;
        const userData = await User.find({
            isAdmin:false,
             $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}},
             ]})
             .limit(limit * 1)
             .skip((page-1) * limit)
             .exec();

             const count = await User.find({
                isAdmin:false,
             $or:[
                {name:{$regex:".*"+search+".*"}},
                {email:{$regex:".*"+search+".*"}},
             ]
             }).countDocuments();

             res.render('customers',{
                data:userData,
                totalPages:Math.ceil(count/limit),
                currentPage:page
             })
        
    } catch (error) {
        res.redirect('/pageerror')
    }
}

const customerBlocked = async (req, res) => {
    try {
      const id = req.query.id
      const page = req.query.page || 1
      const search = req.query.search || ""
      await User.updateOne({ _id: id }, { $set: { isBlocked: true } })
  
      // Emit an event when a user is blocked
      userBlockedEmitter.emit("userBlocked", id)
  
      res.redirect(`/admin/users?page=${page}&search=${search}`)
    } catch (error) {
      res.redirect("/pageerror")
    }
  }

const customerUnblocked = async (req,res) => {
    try {

        let id = req.query.id;
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/users")

        
    } catch (error) {
        res.redirect('/pageerror')
    }
}


const complaints=async(req,res)=>{
    try {
        const adminname=req.session.admin.fullname
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const searchQuery = req.query.search || '';
    
        const filter = {};
        if (searchQuery) {
          filter.$or = [
            { name: { $regex: searchQuery, $options: 'i' } },
            { email: { $regex: searchQuery, $options: 'i' } },
            { message: { $regex: searchQuery, $options: 'i' } }
          ];
        }
    
        const complaints = await Contact.find(filter)
          .sort({ submittedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean();
    
        const total = await Contact.countDocuments(filter);
    
        res.render('complaints', {
          complaints,
          adminname,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        
          },
          searchQuery
        });
      } catch (error) {
        console.error('Error fetching complaints:', error);
        res.status(500).render('error', { message: 'Failed to load complaints' });
      }
    };











module.exports = {
    customerInfo,
    customerBlocked,
    customerUnblocked,
    complaints

}