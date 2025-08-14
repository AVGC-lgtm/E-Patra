const { Sequelize } = require('sequelize');

// Use connection string if available, otherwise use individual variables
let sequelize;

if (process.env.DB_CONNECTION_STRING) {
  // Use connection string (for cloud databases like Neon)
  sequelize = new Sequelize(process.env.DB_CONNECTION_STRING, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false
      }
    }
  });
} else {
  // Fallback to individual environment variables
  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ahilyanagar_feedback',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'your_password_here'
  };

  // Check if using default password
  if (dbConfig.password === 'your_password_here') {
    console.error('⚠️  WARNING: Using default database configuration!');
    console.error('Please create a .env file in the server directory with:');
    console.error('DB_HOST=localhost');
    console.error('DB_PORT=5432');
    console.error('DB_NAME=ahilyanagar_feedback');
    console.error('DB_USER=postgres');
    console.error('DB_PASSWORD=your_actual_password');
    console.error('');
  }

  sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, {
    host: dbConfig.host,
    port: dbConfig.port,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    }
  });
}

// Test the connection
sequelize.authenticate()
  .then(() => console.log('Database connected'))
  .catch((err) => {
    console.error('Database connection error: ', err);
    console.error('');
    console.error('To fix this error:');
    console.error('1. Make sure PostgreSQL is running');
    console.error('2. Check your database connection string in .env file');
    console.error('3. Ensure the database exists and is accessible');
    console.error('4. Verify network connectivity to the database');
  });

module.exports = sequelize;