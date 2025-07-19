const dotenv = require('dotenv');
dotenv.config();  // Load environment variables FIRST

const express = require('express');
const cors = require('cors');
const path = require('path');
const authRoutes = require('./routes/authRoutes');
const roleRoutes = require('./routes/roleRoutes');
const InwardPatraRoutes = require('./routes/InwardPatraRoutes');
const sequelize = require('./config/database');
const Role = require('./models/Role');  // Import Role model
const PoliceStation = require('./models/PoliceStation');  // Import PoliceStation model
const acknowledgmentRoutes = require('./routes/acknowledgmentRoutes');
const policeStationRoutes = require('./routes/policeStationRoutes');  // Import PoliceStation routes
const fileRoutes = require('./routes/fileRoutes');
const coveringLetters = require('./routes/coveringLetterRoutes');
const emailRoutes = require('./routes/emailRoutes');
const emailSenderReceiverRoutes = require('./routes/emailSenderReceiverRoutes');
const dynamicEmailRoutes = require('./routes/dynamicEmailRoutes');
const headRoutes = require('./routes/headRoutes');

const app = express();

// List of default roles you want to create
const defaultRoles = ['inward_user', 'sp', 'head', 'outside_police_station'];

// Create default roles if they don't exist
const createDefaultRoles = async () => {
  try {
    // Check if the roles already exist
    for (const roleName of defaultRoles) {
      const roleExists = await Role.findOne({ where: { roleName } });
      if (!roleExists) {
        await Role.create({ roleName });
        console.log(`Role ${roleName} created successfully.`);
      } else {
        console.log(`Role ${roleName} already exists.`);
      }
    }
  } catch (error) {
    console.error('Error creating default roles:', error);
  }
};

// Function to insert default Police Stations if they don't exist
const createDefaultPoliceStations = async () => {
  const defaultStations = [
    'Nevasa', 'Sonai', 'Rajur', 'Parner', 'Shevgaon', 'Kotwali', 'Toffkhana', 'Shrigonda', 
    'Belvandi', 'MIDC', 'Nagar Taluka', 'Jamkhed', 'Supa', 'Karjat', 'Bhingar Camp', 'Akole',
    'Pathardi', 'Ashvi', 'Shirdi', 'Sangamner Taluka', 'Shani Shingnapur', 'Sangamner City',
    'Shirpur City', 'Rahuri', 'Kopargaon Taluka', 'Kopargaon City', 'Loni', 'Rahata',
    'Sai Temple Security Shirdi', 'City Traffic Branch - Shirdi', 'Kharda', 'Mirajgaon'
  ];

  for (let station of defaultStations) {
    const stationExists = await PoliceStation.findOne({ where: { name: station } });
    if (!stationExists) {
      await PoliceStation.create({ name: station });
      console.log(`Police Station ${station} added successfully.`);
    } else {
      console.log(`Police Station ${station} already exists.`);
    }
  }
};


// Middleware
const corsOptions = {
  origin: '*',  
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); 
app.use(express.json()); 

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if it doesn't exist
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory for file serving');
}

// Create temp directory for CSV imports if it doesn't exist
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
  console.log('Created temp directory for file uploads');
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/patras', InwardPatraRoutes);
app.use('/api/acknowledgments', acknowledgmentRoutes);
app.use('/api', policeStationRoutes); 
app.use('/api/files', fileRoutes);
app.use('/api/letters', coveringLetters);
app.use('/api/email', emailRoutes);
app.use('/api', emailSenderReceiverRoutes);
app.use('/api/dynamic-email', dynamicEmailRoutes);
app.use('/api/head', headRoutes);


// Email configuration verification on startup
const { verifyEmailConfig } = require('./config/email');

// Initialize email configuration
const initializeEmailService = async () => {
  try {
    console.log('Initializing email service...');
    await verifyEmailConfig();
    console.log('✓ Email service initialized successfully');
    
    // Create default email contacts after email service is initialized
  
  } catch (error) {
    console.error('✗ Email service initialization failed:', error);
    console.log('Email functionality will be disabled');
  }
};

// Define model associations
const defineAssociations = () => {
  try {
    const User = require('./models/User');
    const Role = require('./models/Role');

    // User-Role association (if not already defined)
    if (!User.associations.Role) {
      User.belongsTo(Role, { foreignKey: 'roleId' });
    }
    
    console.log('✓ Model associations defined successfully');
  } catch (error) {
    console.error('Error defining associations:', error);
  }
};

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Cannot ${req.method} ${req.url}`
  });
});

// Sync the database and then create the default data before starting the server
sequelize.sync({ force: false, alter: true })  // Automatically update the tables without dropping them
  .then(async () => {
    console.log('Database connected successfully!');

    // Define model associations
    defineAssociations();

    // Create default roles
    await createDefaultRoles();

    // Create default Police Stations if not already present
    await createDefaultPoliceStations();

    // Start the server after initial setup
    app.listen(process.env.PORT || 5000, async () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
      
      // Initialize email service and create default email contacts
      await initializeEmailService();
      
      console.log('✓ Application initialized successfully');
      console.log('Available API endpoints:');
      console.log('  - Auth: /api/auth');
      console.log('  - Roles: /api/roles');
      console.log('  - Patras: /api/patras');
      console.log('  - Acknowledgments: /api/acknowledgments');
      console.log('  - Police Stations: /api/police-stations');
      console.log('  - Files: /api/files');
      console.log('  - Email: /api/email');
      console.log('  - Email Senders: /api/senders');
      console.log('  - Email Receivers: /api/receivers');
      console.log('  - Dynamic Email: /api/dynamic-email');
    });
  })
  .catch((err) => {
    console.error('Error connecting to the database:', err);
  });