const fs = require('fs');
const path = require('path');

const envContent = `# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ahilyanagar_feedback
DB_USER=postgres
DB_PASSWORD=your_password_here

# Server Configuration
PORT=5000

# JWT Secret (for authentication)
JWT_SECRET=your_jwt_secret_here

# Email Configuration (if using email features)
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_email_password

# AWS Configuration (if using AWS services)
AWS_ACCESS_KEY=your_aws_access_key
AWS_SECRET_KEY=your_aws_secret_key
AWS_REGION=your_aws_region
AWS_BUCKET_NAME=your_bucket_name

# Client API URL
REACT_APP_API_URL=http://localhost:5000
`;

const envPath = path.join(__dirname, '.env');

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent);
  console.log('✅ .env file created successfully!');
  console.log('📝 Please edit the .env file and update the following:');
  console.log('   - DB_PASSWORD: Your PostgreSQL password');
  console.log('   - JWT_SECRET: A random string for JWT tokens');
  console.log('   - Other credentials as needed');
} else {
  console.log('⚠️  .env file already exists!');
  console.log('📝 Please check if your database credentials are correct.');
}

console.log('');
console.log('🔧 Next steps:');
console.log('1. Make sure PostgreSQL is running');
console.log('2. Create a database: CREATE DATABASE ahilyanagar_feedback;');
console.log('3. Update the password in the .env file');
console.log('4. Run: npm start'); 