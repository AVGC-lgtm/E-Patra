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
const fileRoutes = require('./routes/fileRoutes');
const coveringLetters = require('./routes/coveringLetterRoutes');
// Removed headRoutes import

const app = express();

// Define roles with only inward_user role
const defaultRolesStructure = [
  {
    roleName: 'inward_user',
    table: 'inward',
    categories: []
  }
];

// Create default roles with exact structure if they don't exist
const createDefaultRoles = async () => {
  try {
    console.log('\n=== Creating/Updating Roles ===');
    for (const roleData of defaultRolesStructure) {
      const roleExists = await Role.findOne({ where: { roleName: roleData.roleName } });
      if (!roleExists) {
        await Role.create({
          roleName: roleData.roleName,
          table: roleData.table,
          categories: roleData.categories
        });
        console.log(`✓ Role created: ${roleData.roleName} | Table: ${roleData.table} | Categories: [${roleData.categories.join(', ')}]`);
      } else {
        // Update existing role if structure has changed
        const needsUpdate = 
          roleExists.table !== roleData.table || 
          JSON.stringify(roleExists.categories) !== JSON.stringify(roleData.categories);
        
        if (needsUpdate) {
          await roleExists.update({ 
            table: roleData.table,
            categories: roleData.categories
          });
          console.log(`✓ Role updated: ${roleData.roleName} | Table: ${roleData.table} | Categories: [${roleData.categories.join(', ')}]`);
        } else {
          console.log(`• Role exists: ${roleData.roleName}`);
        }
      }
    }
    console.log('=== Roles Setup Complete ===\n');
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
app.use('/api/files', fileRoutes);
app.use('/api/letters', coveringLetters);
// Removed head routes

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

    // Create default roles with proper structure
    await createDefaultRoles();

    // Start the server after initial setup
    app.listen(process.env.PORT || 5000, async () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('Error connecting to the database:', err);
  });