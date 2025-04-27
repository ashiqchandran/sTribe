const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const sharp = require("sharp");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto"); // ✅ Import Node.js crypto module
const EventEmitter = require("events");
const productBlockedEmitter = new EventEmitter();



const pageNotFound = async (req, res) => {
  res.render("pageError");
};


const getProductAddPage = async (req, res) => {
  try {
      const categories = await Category.find();
      res.render("Products", { categories });
  } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).send("Error loading product page.");
  }
};

// POST: Add Product
// POST: Add Product


const addProduct = async (req, res) => {
  try {
    // 1. First handle file uploads
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No images uploaded." });
    }

    console.log("Received fields:", Object.keys(req.body));
    
    // 2. Process images
    let imagePaths = [];
    const uploadDir = path.join(__dirname, "../../public/uploads");

    // Create upload directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    for (let file of req.files) {
      try {
        const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.jpg`;
        const filePath = path.join(uploadDir, fileName);

        await sharp(file.buffer)
          .resize(500, 500)
          .toFormat('jpeg')
          .jpeg({ quality: 80 })
          .toFile(filePath);

        imagePaths.push(`/uploads/${fileName}`);
      } catch (sharpError) {
        console.error("Error processing image:", sharpError);
        return res.status(500).json({ success: false, message: "Error processing image." });
      }
    }

    // 3. Parse variants from JSON string
    let variants = [];
    if (req.body.variants) {
      try {
        variants = JSON.parse(req.body.variants);
        
        // Validate variants
        if (!Array.isArray(variants)) {
          return res.status(400).json({ 
            success: false, 
            message: "Variants must be an array." 
          });
        }
        
        // Log variants for debugging
        variants.forEach((variant, index) => {
          console.log(`Variant ${index + 1}:`, variant);
        });
      } catch (e) {
        console.error("Error parsing variants:", e);
        return res.status(400).json({ 
          success: false, 
          message: "Invalid variants data format." 
        });
      }
    }

    // 4. Create the product with variants
    const newProduct = new Product({
      productName: req.body.productName,
      description: req.body.description,
      category: req.body.category,
      regularPrice: req.body.regularPrice,
      salePrice: req.body.salePrice,
      size: req.body.size || "M", // Default size
      color: req.body.color || "blue", // Default color
      quantity: req.body.quantity,
      productImage: imagePaths,
      variants: variants // This now contains all variants
    });

    await newProduct.save();
    
    res.json({ success: true, message: "Product added successfully!" });
    
  } catch (error) {
    console.error("Error adding product:", error);
    res.status(500).json({ 
      success: false, 
      message: "Server Error",
      error: error.message 
    });
  }
};



const getAllProducts = async (req, res) => {
  try {
    const search = req.query.search || "";
    let page = parseInt(req.query.page) || 1;
    const limit =10;

    if (page < 1) page = 1;

    const query = {
      productName: { $regex: new RegExp(".*" + search + ".*", "i") },
    };

    const productData = await Product.find(query, "productName category isBlocked salePrice regularPrice quantity productImage productOffer color brand")

      .limit(limit)
      .skip((page - 1) * limit)
      .populate("category")
      .exec();

    

    const count = await Product.countDocuments(query);
    const category = await Category.find({ isListed: true });
console.log("productData = ",productData)
    if (category.length > 0) {
      res.render("product_all", {
        data: productData,
        currentPage: page,
        totalPages: Math.ceil(count / limit),
        cat: category,
      });
    } else {
      res.render("pageError");
    }
  } catch (error) {
    console.error("Error fetching products:", error);
    res.render("pageError");
  }
};
const updateProductOffer = async (req, res) => {
  try {
    const { productId, percentage } = req.body;
    console.log("Received data:", { productId, percentage });

    // Validate inputs
    const offerPercentage = parseFloat(percentage);
    if (!productId || isNaN(offerPercentage)) {
      return res.status(400).json({
        status: false,
        message: "Product ID and a valid numeric offer percentage are required",
      });
    }

    // Get the product
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    // Get the category associated with the product
    const category = await Category.findById(product.category);
    const categoryOffer = category?.categoryOffer || 0;

    // Choose the maximum of product offer and category offer
    const maxOffer = Math.max(offerPercentage, categoryOffer);

    // Update offer and sale price (based on original price to avoid double-discounting)
    product.productOffer = offerPercentage;
    product.salePrice = product.regularPrice - ((maxOffer / 100) * product.regularPrice);

    await product.save();

    res.json({ status: true, message: "Offer updated successfully" });
  } catch (error) {
    console.error("Error updating offer:", error);
    res.status(500).json({ status: false, message: "An error occurred while updating the offer" });
  }
};

const removeProductOffer = async (req, res) => {
  try {
    const { productId } = req.body;

    if (!productId) {
      return res.status(400).json({ status: false, message: "Product ID is required" });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

    product.productOffer = 0;
    product.salePrice = product.regularPrice;

    await product.save();

    res.json({ status: true, message: "Offer removed successfully" });
  } catch (error) {
    console.error("Error in removeProductOffer:", error);
    res.status(500).json({ status: false, message: "Internal server error" });
  }
};

const getEditProduct = async (req, res) => {
  try {
    const id = req.query.id;
    console.log("the id = ",id)
    const product = await Product.findOne({ _id: id }).populate("category");
    const categories = await Category.find({});

    if (!product) {
      return res.status(404).send("Product not found");
    }

    res.render("product-edit", {
      product: product,
      cat: categories,
    });
  } catch (error) {
    console.error("Error in getEditProduct:", error);
    res.redirect("/pageError");
  }
};


//get edit

const editProduct = async (req, res) => {
  try {

    const id = req.params.id;
    const { productName, description, regularPrice, salePrice, quantity, category,brand,size,color } = req.body;
console.log("the eode was working for the updation")
    // Check if a product with the same name exists (excluding the current one)
    const existingProduct = await Product.findOne({ productName, _id: { $ne: id } });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: "Product with this name already exists. Please try another name.",
      });
    }
    
    
    // Find the existing product
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Ensure `productImage` is an array
    product.productImage = product.productImage || [];

    // Define upload directory (same as `addProduct`)
    const uploadDir = path.join(__dirname, "../../public/uploads");

    // Ensure the upload directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Process images (replace existing ones if a new image is uploaded)
    for (let i = 1; i <= 4; i++) {
      if (req.files && req.files[`image${i}`]) {
        const file = req.files[`image${i}`][0];
        const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(2, 10)}.jpg`;
        const filePath = path.join(uploadDir, fileName);

        // Process and save image (match `addProduct` behavior)
        await sharp(file.buffer)
          .resize(500, 500) // Resize before saving
          .toFormat("jpeg")
          .jpeg({ quality: 80 })
          .toFile(filePath);

        const imagePath = `/uploads/${fileName}`; // Ensure same path format as `addProduct`

        // Replace existing image or add a new one
        product.productImage[i - 1] = imagePath;
      }
    }

    // Update product fields
    product.productName = productName;
    product.description = description;
    product.regularPrice = regularPrice;
    product.salePrice = salePrice;
    product.quantity = quantity;
    product.category = category;
    product.color = color;
    product.size = size;
    product.brand = brand;
    await product.save();

    res.redirect("/admin/allProducts")
  } catch (error) {
    console.error("Error in editProduct:", error);
    res.status(500).json({ success: false, message: "An error occurred while updating the product" });
  }
};



const deleteSingleImage = async (req, res) => {
  try {
   

    const { imageNameToServer, productIdToServer, imageIndex } = req.body;
    const product = await Product.findById(productIdToServer);

    if (!product) {
      return res.status(404).json({ status: false, message: "Product not found" });
    }

   

    // Check if the imageIndex is valid
    if (imageIndex < 0 || imageIndex >= product.productImage.length) {
      return res.status(400).json({ status: false, message: "Invalid image index" });
    }

    // Remove the image from the array
    const deletedImage = product.productImage.splice(imageIndex, 1);
    await product.save();

    console.log("After deletion, images:", product.productImage);

    // Define the image path
    const imagePath = path.join(__dirname, "../../public/uploads", imageNameToServer);

    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
      console.log(`Image ${imageNameToServer} deleted successfully`);
    } else {
      console.log(`Image ${imageNameToServer} not found`);
    }

    res.json({ status: true, message: "Image deleted successfully" });

  } catch (error) {
    console.error("Error in deleteSingleImage:", error);
    res.status(500).json({ status: false, message: "An error occurred while deleting the image" });
  }
};


const blockProduct = async (req, res) => {
  try {
    const id = req.body.id; // Change to body, since it's a POST request

    // Check if the ID is provided and valid
    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("Valid Product ID is required");
    }

    const page = req.body.page || 1; // Get page number from body (for consistency)
    const search = req.body.search || "";

    // Find the product by ID
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Block the product by setting isBlocked to true
    await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });

    // Emit an event when a product is blocked
    productBlockedEmitter.emit("productBlocked", id);

    // Respond with a success message (instead of redirecting)
    res.json({ success: true, message: "Product blocked successfully" });

  } catch (error) {
    console.error("Error blocking product:", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};

const unblockProduct = async (req, res) => {
  try {
    const id = req.body.id; // Change to body, since it's a POST request

    // Check if the ID is provided and valid
    if (!id || !isValidObjectId(id)) {
      return res.status(400).send("Valid Product ID is required");
    }

    const page = req.body.page || 1; // Get page number from body
    const search = req.body.search || "";

    // Find the product by ID
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).send("Product not found");
    }

    // Unblock the product by setting isBlocked to false
    await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });

    // Emit an event when a product is unblocked
    productBlockedEmitter.emit("productUnblocked", id);

    // Respond with a success message (instead of redirecting)
    res.json({ success: true, message: "Product unblocked successfully" });

  } catch (error) {
    console.error("Error unblocking product:", error);
    res.status(500).json({ success: false, message: "An error occurred" });
  }
};


// Utility function to check if the provided id is a valid ObjectId
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};




const uploadProductImages = async (req, res) => {
  try {
    const { files } = req;

    if (!files || files.length === 0) {
      return res.status(400).send("No files uploaded.");
    }

    const productId = req.body.productId;
    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).send("Product not found");
    }

    const imageUrls = files.map(file => file.path);  // Assuming you use multer to handle file uploads

    // Add the image URLs to the product's productImage field
    product.productImage.push(...imageUrls);
    await product.save();

    res.json({ message: "Images uploaded successfully!" });
  } catch (error) {
    console.error("Error uploading product images: ", error);
    res.status(500).send("An error occurred while uploading images.");
  }
};

const deleteProduct = async (req, res) => {
  try {
    const { id } = req.body; // Get product ID from the request body

    // Find the product by ID
    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    // Optional: Delete associated product images from the server
    const uploadDir = path.join(__dirname, "../../public/uploads");
    product.productImage.forEach(imagePath => {
      const imageFilePath = path.join(uploadDir, imagePath.replace('/uploads/', ''));
      if (fs.existsSync(imageFilePath)) {
        fs.unlinkSync(imageFilePath); // Delete the image from the file system
      }
    });

    // Delete the product from the database
    await Product.deleteOne({ _id: id });

    res.json({ success: true, message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ success: false, message: "An error occurred while deleting the product" });
  }
};

// Export all functions
module.exports = {
  getProductAddPage,
  pageNotFound,
  addProduct,
  getAllProducts,
  updateProductOffer,
  removeProductOffer,
  editProduct,
  getEditProduct,
  blockProduct,
  unblockProduct,
  uploadProductImages,
  deleteSingleImage,
  deleteProduct
};
