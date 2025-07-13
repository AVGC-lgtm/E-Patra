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
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/patras', InwardPatraRoutes);
app.use('/api/acknowledgments', acknowledgmentRoutes);
app.use('/api', policeStationRoutes); 
app.use('/api/files', fileRoutes);

// Sync the database and then create the default roles and stations before starting the server
sequelize.sync({ force: false, alter: true })  // Automatically update the tables without dropping them
  .then(async () => {
    console.log('Database connected successfully!');

    // Create default roles
    await createDefaultRoles();

    // Create default Police Stations if not already present
    await createDefaultPoliceStations();

    // Start the server after roles and police stations are created
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('Error connecting to the database:', err);
  });
