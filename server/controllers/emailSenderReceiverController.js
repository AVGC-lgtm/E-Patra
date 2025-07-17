// controllers/emailSenderReceiverController.js
const EmailSender = require('../models/EmailSender');
const EmailReceiver = require('../models/EmailReceiver');

// Email Sender CRUD
const emailSenderController = {
  // Create
  async create(req, res) {
    try {
      const sender = await EmailSender.create(req.body);
      res.status(201).json(sender);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Read all
  async getAll(req, res) {
    try {
      const senders = await EmailSender.findAll({ where: { isActive: true } });
      res.json(senders);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Read one
  async getById(req, res) {
    try {
      const sender = await EmailSender.findByPk(req.params.id);
      if (!sender) return res.status(404).json({ error: 'Sender not found' });
      res.json(sender);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Update
  async update(req, res) {
    try {
      const [updated] = await EmailSender.update(req.body, {
        where: { id: req.params.id }
      });
      if (!updated) return res.status(404).json({ error: 'Sender not found' });
      const sender = await EmailSender.findByPk(req.params.id);
      res.json(sender);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Delete (soft delete)
  async delete(req, res) {
    try {
      const [updated] = await EmailSender.update(
        { isActive: false },
        { where: { id: req.params.id } }
      );
      if (!updated) return res.status(404).json({ error: 'Sender not found' });
      res.json({ message: 'Sender deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

// Email Receiver CRUD
const emailReceiverController = {
  // Create
  async create(req, res) {
    try {
      const receiver = await EmailReceiver.create(req.body);
      res.status(201).json(receiver);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Read all
  async getAll(req, res) {
    try {
      const receivers = await EmailReceiver.findAll({ where: { isActive: true } });
      res.json(receivers);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Read one
  async getById(req, res) {
    try {
      const receiver = await EmailReceiver.findByPk(req.params.id);
      if (!receiver) return res.status(404).json({ error: 'Receiver not found' });
      res.json(receiver);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // Update
  async update(req, res) {
    try {
      const [updated] = await EmailReceiver.update(req.body, {
        where: { id: req.params.id }
      });
      if (!updated) return res.status(404).json({ error: 'Receiver not found' });
      const receiver = await EmailReceiver.findByPk(req.params.id);
      res.json(receiver);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  },

  // Delete (soft delete)
  async delete(req, res) {
    try {
      const [updated] = await EmailReceiver.update(
        { isActive: false },
        { where: { id: req.params.id } }
      );
      if (!updated) return res.status(404).json({ error: 'Receiver not found' });
      res.json({ message: 'Receiver deleted successfully' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
};

module.exports = { emailSenderController, emailReceiverController };