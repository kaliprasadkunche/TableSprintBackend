const express = require('express');
const mysql2 = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(cors());

// const db = mysql2.createConnection({
//     host: 'localhost',
//     user: 'root',
//     password: 'Kali659600',
//     database: 'tablesprint' 
// });

const db = mysql2.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    return;
  }
  console.log('Connected to MySQL Database');
});


const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '1h' });
};

// Create categories table if it does not exist
const createUsersTable = `
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL
)
`;
db.query(createUsersTable, (err) => {
  if (err) console.error('Error creating table:', err);
});

// Register User Endpoint
app.post('/register', (req, res) => {
  const { email, password } = req.body;
  const checkUserQuery = 'SELECT * FROM users WHERE email = ?';
  db.query(checkUserQuery, [email], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    if (result.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const insertUserQuery = 'INSERT INTO users (email, password) VALUES (?, ?)';
    db.query(insertUserQuery, [email, passwordHash], (err) => {
      if (err) return res.status(500).json({ message: 'Database error' });

      res.status(201).json({ message: 'User registered successfully' });
    });
  });
});

// Login User Endpoint
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const findUserQuery = 'SELECT * FROM users WHERE email = ?';
  db.query(findUserQuery, [email], (err, result) => {
    if (err) return res.status(500).json({ message: 'Database error' });

    const user = result[0];
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isPasswordValid = bcrypt.compareSync(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = createToken(user.id);
    res.json({ token });
  });
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers['authorization'];
  if (!token) return res.status(403).json({ message: 'Token required' });

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ message: 'Unauthorized' });
    req.userId = decoded.id;
    next();
  });
};

// Example of a protected route
app.get('/protected', verifyToken, (req, res) => {
  res.status(200).json({ message: 'Protected content' });
});

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  }
});
const upload = multer({ storage });

// API to handle image upload
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const imageUrl = `/uploads/${req.file.filename}`;
  res.json({ imageUrl });
});

// Create categories table if it does not exist
const createCategoryTable = `
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  sequence INT NOT NULL,
  image_url VARCHAR(255),
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`;
db.query(createCategoryTable, (err) => {
  if (err) console.error('Error creating table:', err);
});

app.get('/categories', (req, res) => {
  db.query('SELECT * FROM categories', (err, results) => {
    if (err) {
      console.error('Error fetching categories:', err);
      return res.status(500).json({ error: 'Failed to fetch categories' });
    }
    res.json(results);
  });
});

app.post('/categories', (req, res) => {
  const { name, sequence, image_url, status } = req.body;
  db.query('INSERT INTO categories (name, sequence, image_url, status) VALUES (?, ?, ?, ?)', [name, sequence, image_url, status], (err, results) => {
    if (err) {
      console.error('Error adding category:', err);
      return res.status(500).json({ error: 'Failed to add category' });
    }
    res.json({ id: results.insertId });
  });
});

app.put('/categories/:id', (req, res) => {
  const { id } = req.params;
  const { name, sequence, image_url, status } = req.body;
  db.query('UPDATE categories SET name = ?, sequence = ?, image_url = ?, status = ? WHERE id = ?', [name, sequence, image_url, status, id], (err) => {
    if (err) {
      console.error('Error updating category:', err);
      return res.status(500).json({ error: 'Failed to update category' });
    }
    res.json({ message: 'Category updated successfully' });
  });
});

app.delete('/categories/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM categories WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting category:', err);
      return res.status(500).json({ error: 'Failed to delete category' });
    }
    res.json({ message: 'Category deleted successfully' });
  });
});

// Serve static files from "uploads" directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));


//Sub Category

const createSubCategoryTable = `
CREATE TABLE IF NOT EXISTS subcategories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  subname VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sequence INT NOT NULL,
  image_url VARCHAR(255),
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`;
db.query(createSubCategoryTable, (err) => {
  if (err) console.error('Error creating table:', err);
});

app.get('/subcategories', (req, res) => {
  db.query('SELECT * FROM subcategories', (err, results) => {
    if (err) {
      console.error('Error fetching subcategories:', err);
      return res.status(500).json({ error: 'Failed to fetch subcategories' });
    }
    res.json(results);
  });
});

app.post('/subcategories', (req, res) => {
  const { subname, name, sequence, image_url, status } = req.body;
  db.query('INSERT INTO subcategories (subname, name, sequence, image_url, status) VALUES (?, ?, ?, ?, ?)', [subname, name, sequence, image_url, status], (err, results) => {
    if (err) {
      console.error('Error adding subcategory:', err);
      return res.status(500).json({ error: 'Failed to add subcategory' });
    }
    res.json({ id: results.insertId });
  });
});

app.put('/subcategories/:id', (req, res) => {
  const { id } = req.params;
  const { subname, name, sequence, image_url, status } = req.body;
  db.query('UPDATE subcategories SET subname = ?, name = ?, sequence = ?, image_url = ?, status = ? WHERE id = ?', [subname,name, sequence, image_url, status, id], (err) => {
    if (err) {
      console.error('Error updating subcategory:', err);
      return res.status(500).json({ error: 'Failed to update subcategory' });
    }
    res.json({ message: 'SubCategory updated successfully' });
  });
});

app.delete('/subcategories/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM subcategories WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting subcategory:', err);
      return res.status(500).json({ error: 'Failed to delete subcategory' });
    }
    res.json({ message: 'SubCategory deleted successfully' });
  });
});



//Sub Category

const createProductTable = `
CREATE TABLE IF NOT EXISTS product (
  id INT AUTO_INCREMENT PRIMARY KEY,
  proname VARCHAR(255) NOT NULL,
  subname VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  sequence INT NOT NULL,
  image_url VARCHAR(255),
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`;
db.query(createProductTable, (err) => {
  if (err) console.error('Error creating table:', err);
});

app.get('/product', (req, res) => {
  db.query('SELECT * FROM product', (err, results) => {
    if (err) {
      console.error('Error fetching product:', err);
      return res.status(500).json({ error: 'Failed to fetch product' });
    }
    res.json(results);
  });
});

app.post('/product', (req, res) => {
  const { proname, subname, name, sequence, image_url, status } = req.body;
  db.query('INSERT INTO product (proname, subname, name, sequence, image_url, status) VALUES (?, ?, ?, ?, ?, ?)', [proname, subname, name, sequence, image_url, status], (err, results) => {
    if (err) {
      console.error('Error adding product:', err);
      return res.status(500).json({ error: 'Failed to add product' });
    }
    res.json({ id: results.insertId });
  });
});

app.put('/product/:id', (req, res) => {
  const { id } = req.params;
  const { proname, subname, name, sequence, image_url, status } = req.body;
  db.query('UPDATE product SET proname = ?, subname = ?, name = ?, sequence = ?, image_url = ?, status = ? WHERE id = ?', [proname, subname,name, sequence, image_url, status, id], (err) => {
    if (err) {
      console.error('Error updating product:', err);
      return res.status(500).json({ error: 'Failed to update product' });
    }
    res.json({ message: 'product updated successfully' });
  });
});

app.delete('/product/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM product WHERE id = ?', [id], (err) => {
    if (err) {
      console.error('Error deleting product:', err);
      return res.status(500).json({ error: 'Failed to delete product' });
    }
    res.json({ message: 'product deleted successfully' });
  });
});

// Start server
app.listen(5000, () => {
  console.log('Server running on port 5000');
});
