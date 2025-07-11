// routes/policeStationRoutes.js
const express = require('express');
const PoliceStation = require('../models/PoliceStation');
const router = express.Router();

router.get('/police-stations', async (req, res) => {
  try {
    const stations = await PoliceStation.findAll();
    res.json(stations);
  } catch (error) {
    res.status(500).json({ message: 'Error retrieving stations' });
  }
});

module.exports = router;
