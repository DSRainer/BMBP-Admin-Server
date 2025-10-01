const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://rainer:fd7w3omJWsdJ7M2x@cluster0.g2zilxi.mongodb.net/bookmybirthdayparty?retryWrites=true&w=majority&appName=Cluster0';
const DB_NAME = 'bookmybirthdayparty';

let db;

// Middleware
app.use(cors());
app.use(express.json());

// CORS options
const allowedOrigins = [
  "https://bmbp-admin.vercel.app",
  "https://bmbp-admin-bhavya-singhals-projects.vercel.app",
  "https://bmbp-admin-git-main-bhavya-singhals-projects.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));


// Connect to MongoDB
async function connectToDatabase() {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    db = client.db(DB_NAME);
    console.log('Connected to MongoDB successfully');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
}

// API Routes

// Get all enquiries
app.get('/api/enquiries', async (req, res) => {
  try {
    const enquiries = await db.collection('enquiries').find({}).toArray();
    console.log(`Fetched ${enquiries.length} enquiries from MongoDB`);
    res.json(enquiries);
  } catch (error) {
    console.error('Error fetching enquiries:', error);
    res.status(500).json({ error: 'Failed to fetch enquiries' });
  }
});

// Get enquiry by ID
app.get('/api/enquiries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const enquiry = await db.collection('enquiries').findOne({ _id: new ObjectId(id) });
    
    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    
    res.json(enquiry);
  } catch (error) {
    console.error('Error fetching enquiry:', error);
    res.status(500).json({ error: 'Failed to fetch enquiry' });
  }
});

// Create new enquiry
app.post('/api/enquiries', async (req, res) => {
  try {
    const enquiryData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('enquiries').insertOne(enquiryData);
    const newEnquiry = await db.collection('enquiries').findOne({ _id: result.insertedId });
    
    res.status(201).json(newEnquiry);
  } catch (error) {
    console.error('Error creating enquiry:', error);
    res.status(500).json({ error: 'Failed to create enquiry' });
  }
});

// Update enquiry
app.put('/api/enquiries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('=== UPDATE ENQUIRY REQUEST ===');
    console.log('Enquiry ID received:', id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('ID type:', typeof id);
    console.log('ID length:', id.length);
    
    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      console.error('❌ Invalid ObjectId format for enquiry:', id);
      return res.status(400).json({ error: 'Invalid enquiry ID format' });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    // Remove immutable fields that MongoDB doesn't allow updating
    delete updateData._id;
    delete updateData.id;
    
    // Handle status field initialization for existing enquiries
    if (updateData.status && !updateData.isResolved) {
      // Map status to isResolved for backward compatibility
      if (updateData.status === 'Closed') {
        updateData.isResolved = true;
      } else {
        updateData.isResolved = false;
      }
    }
    
    console.log('Update data to be applied:', JSON.stringify(updateData, null, 2));
    
    const objectId = new ObjectId(id);
    console.log('MongoDB ObjectId created:', objectId);
    
    const result = await db.collection('enquiries').updateOne(
      { _id: objectId },
      { $set: updateData }
    );
    
    console.log('MongoDB update result:', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      acknowledged: result.acknowledged
    });
    
    if (result.matchedCount === 0) {
      console.error('❌ Enquiry not found with ID:', id);
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    
    const updatedEnquiry = await db.collection('enquiries').findOne({ _id: objectId });
    console.log('✅ Enquiry updated successfully');
    console.log('Updated enquiry from MongoDB:', JSON.stringify(updatedEnquiry, null, 2));
    
    // Verify data integrity after save
    console.log('📊 Data integrity check after MongoDB save:', {
      hasName: !!updatedEnquiry.name,
      hasEmail: !!updatedEnquiry.email,
      hasPhone: !!updatedEnquiry.phone,
      hasEventDate: !!updatedEnquiry.eventDate,
      status: updatedEnquiry.status,
      isResolved: updatedEnquiry.isResolved
    });
    
    // IMPORTANT: Verify the status was actually updated in the database
    console.log('ℹ️ STATUS VERIFICATION - Enquiry status in database is now:', updatedEnquiry.status);
    
    // Double-check by fetching all enquiries and showing status distribution
    const allEnquiries = await db.collection('enquiries').find({}).toArray();
    const statusCounts = {};
    allEnquiries.forEach(enquiry => {
      const status = enquiry.status || 'No Status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('📊 AFTER UPDATE - Current database enquiry status distribution:', statusCounts);
    
    res.json(updatedEnquiry);
  } catch (error) {
    console.error('❌ Error updating enquiry:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);
    res.status(500).json({ 
      error: 'Failed to update enquiry',
      details: error.message,
      errorType: error.name
    });
  }
});

// Delete enquiry
app.delete('/api/enquiries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.collection('enquiries').deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }
    
    res.json({ message: 'Enquiry deleted successfully' });
  } catch (error) {
    console.error('Error deleting enquiry:', error);
    res.status(500).json({ error: 'Failed to delete enquiry' });
  }
});

// Debug endpoint for enquiries
app.get('/api/debug/enquiries', async (req, res) => {
  try {
    const allEnquiries = await db.collection('enquiries').find({}).toArray();
    console.log('🕵️ DEBUG - All enquiries in database:');
    allEnquiries.forEach((enquiry, index) => {
      console.log(`${index + 1}. ID: ${enquiry._id} | Name: ${enquiry.name} | Status: ${enquiry.status}`);
    });
    
    res.json({
      count: allEnquiries.length,
      enquiries: allEnquiries.map(e => ({
        _id: e._id,
        name: e.name,
        status: e.status,
        email: e.email
      }))
    });
  } catch (error) {
    console.error('❌ Error fetching debug enquiries:', error);
    res.status(500).json({ error: 'Failed to fetch debug data' });
  }
});

// Get all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await db.collection('bookings').find({}).toArray();
    console.log(`Fetched ${bookings.length} bookings from MongoDB`);
    
    // Debug: Show current status distribution
    const statusCounts = {};
    bookings.forEach(booking => {
      const status = booking.status || 'No Status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('📊 Current booking status distribution:', statusCounts);
    
    res.json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get booking by ID
app.get('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(id) });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Create new booking
app.post('/api/bookings', async (req, res) => {
  try {
    const bookingData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const result = await db.collection('bookings').insertOne(bookingData);
    const newBooking = await db.collection('bookings').findOne({ _id: result.insertedId });
    
    res.status(201).json(newBooking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Update booking
app.put('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('=== UPDATE BOOKING REQUEST ===');
    console.log('Booking ID received:', id);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('ID type:', typeof id);
    console.log('ID length:', id.length);
    
    // Validate ObjectId format
    if (!ObjectId.isValid(id)) {
      console.error('❌ Invalid ObjectId format:', id);
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    console.log('Update data to be applied:', JSON.stringify(updateData, null, 2));
    
    const objectId = new ObjectId(id);
    console.log('MongoDB ObjectId created:', objectId);
    
    const result = await db.collection('bookings').updateOne(
      { _id: objectId },
      { $set: updateData }
    );
    
    console.log('MongoDB update result:', {
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
      acknowledged: result.acknowledged
    });
    
    if (result.matchedCount === 0) {
      console.error('❌ Booking not found with ID:', id);
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    const updatedBooking = await db.collection('bookings').findOne({ _id: objectId });
    console.log('✅ Booking updated successfully');
    console.log('Updated booking from MongoDB:', JSON.stringify(updatedBooking, null, 2));
    
    // Verify data integrity after save
    console.log('📊 Data integrity check after MongoDB save:', {
      hasPackageDetails: !!updatedBooking.packageDetails,
      hasThemes: !!updatedBooking.themes?.length,
      hasAddons: !!updatedBooking.addons?.length,
      totalAmount: updatedBooking.totalAmount,
      status: updatedBooking.status,
      packageDetailsKeys: updatedBooking.packageDetails ? Object.keys(updatedBooking.packageDetails) : 'N/A',
      themesCount: updatedBooking.themes?.length || 0,
      addonsCount: updatedBooking.addons?.length || 0
    });
    
    // IMPORTANT: Verify the status was actually updated in the database
    console.log('ℹ️ STATUS VERIFICATION - Booking status in database is now:', updatedBooking.status);
    
    // Double-check by fetching all bookings and showing status distribution
    const allBookings = await db.collection('bookings').find({}).toArray();
    const statusCounts = {};
    allBookings.forEach(booking => {
      const status = booking.status || 'No Status';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });
    console.log('📊 AFTER UPDATE - Current database status distribution:', statusCounts);
    
    res.json(updatedBooking);
  } catch (error) {
    console.error('❌ Error updating booking:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Full error object:', error);
    res.status(500).json({ 
      error: 'Failed to update booking',
      details: error.message,
      errorType: error.name
    });
  }
});

// Delete booking
app.delete('/api/bookings/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.collection('bookings').deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }
    
    res.json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// Get collections info (for debugging)
app.get('/api/collections', async (req, res) => {
  try {
    const collections = await db.listCollections().toArray();
    res.json(collections.map(col => col.name));
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({ error: 'Failed to fetch collections' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

// Debug endpoint to check specific booking data
app.get('/api/debug/booking/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('=== DEBUG ENDPOINT - Checking booking ===');
    console.log('Booking ID:', id);
    
    if (!ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }
    
    const booking = await db.collection('bookings').findOne({ _id: new ObjectId(id) });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found in database' });
    }
    
    const debugInfo = {
      bookingId: booking._id,
      status: booking.status,
      customerName: booking.customerName,
      hasPackageDetails: !!booking.packageDetails,
      hasThemes: !!booking.themes?.length,
      hasAddons: !!booking.addons?.length,
      totalAmount: booking.totalAmount,
      packageDetails: booking.packageDetails,
      themes: booking.themes,
      addons: booking.addons,
      lastUpdated: booking.updatedAt,
      allFields: Object.keys(booking)
    };
    
    console.log('Debug info for booking:', JSON.stringify(debugInfo, null, 2));
    res.json({ booking, debugInfo });
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    res.status(500).json({ error: 'Debug endpoint failed', details: error.message });
  }
});

// Start server
async function startServer() {
  await connectToDatabase();
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`API endpoints available at http://localhost:${PORT}/api`);
  });
}

startServer().catch(console.error);