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
const headRoutes = require('./routes/headRoutes');
// const emailReplyRoutes = require('./routes/emailReplyRoutes');

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



// Middleware
const corsOptions = {
  origin: '*',  
  methods: ['GET', 'POST', 'PUT', 'DELETE'], 
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions)); 
app.use(express.json()); 


// Routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/patras', InwardPatraRoutes);
app.use('/api/acknowledgments', acknowledgmentRoutes);
app.use('/api', policeStationRoutes); 
app.use('/api/files', fileRoutes);
app.use('/api/letters', coveringLetters);
app.use('/api/head', headRoutes);
// app.use('/api/email-reply', emailReplyRoutes);





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



    // Start the server after initial setup
    app.listen(process.env.PORT || 5000, async () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);

    });
  })
  .catch((err) => {
    console.error('Error connecting to the database:', err);
  });