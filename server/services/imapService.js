const Imap = require('imap');
const { simpleParser } = require('mailparser');

class ImapService {
  constructor(config) {
    this.imapConfig = config;
    this.imap = null;
    this.isConnected = false;
    this.mailCheckInterval = null;
  }

  connect() {
    this.imap = new Imap(this.imapConfig);
    return new Promise((resolve, reject) => {
      this.imap.once('ready', () => {
        console.log('IMAP connected successfully');
        this.isConnected = true;
        resolve();
      });
      this.imap.once('error', (err) => {
        console.error('IMAP connection error:', err);
        this.isConnected = false;
        reject(err);
      });
      this.imap.once('close', () => {
        console.log('IMAP connection closed');
        this.isConnected = false;
      });
      this.imap.connect();
    });
  }

  fetchUnreadEmails(onMail) {
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) throw err;
      this.imap.search(['UNSEEN'], (err, results) => {
        if (err) throw err;
        if (!results || !results.length) {
          console.log('No unread emails found');
          return;
        }
        
        console.log(`Found ${results.length} unread emails`);
        
        const f = this.imap.fetch(results, { 
          bodies: '',
          struct: true,
          markSeen: false
        });
        
        f.on('message', (msg, seqno) => {
          let buffer = '';
          
          msg.on('body', (stream, info) => {
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
          });
          
          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(buffer, {
                streamAttachments: false
              });
              onMail(parsed);
            } catch (error) {
              console.error('Error parsing email:', error);
            }
          });
        });
        
        f.once('error', (err) => console.log('Fetch error: ' + err));
      });
    });
  }

  listenForNewMail(onMail) {
    console.log('Setting up email listener...');
    
    // Use configurable check interval or default to 30 seconds
    const checkInterval = this.imapConfig.checkInterval || 30000;
    let lastChecked = new Date();
    
    // Initial check for existing unread emails
    this.checkForNewEmails(onMail, lastChecked);
    
    // Set up periodic checking
    this.mailCheckInterval = setInterval(() => {
      console.log('Checking for new emails...');
      this.checkForNewEmails(onMail, lastChecked);
      lastChecked = new Date();
    }, checkInterval);
    
    console.log(`Email listener started - checking every ${checkInterval/1000} seconds`);
  }
  
  checkForNewEmails(onMail, sinceDate) {
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('Error opening INBOX:', err);
        return;
      }
      
      // Search for unread emails
      this.imap.search(['UNSEEN'], (err, results) => {
        if (err) {
          console.error('Error searching emails:', err);
          return;
        }
        
        if (!results || !results.length) {
          return;
        }
        
        console.log(`Found ${results.length} unread email(s)`);
        
        const f = this.imap.fetch(results, { 
          bodies: '',
          struct: true,
          markSeen: false // Don't automatically mark as seen
        });
        
        f.on('message', (msg, seqno) => {
          let buffer = '';
          let attrs = null;
          
          msg.on('body', (stream, info) => {
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
          });
          
          msg.once('attributes', (attributes) => {
            attrs = attributes;
          });
          
          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(buffer, {
                streamAttachments: false
              });
              
              // Check if this is a new email (received after last check)
              if (!sinceDate || new Date(parsed.date) > sinceDate) {
                console.log(`📧 New email detected: ${parsed.subject}`);
                onMail(parsed);
                
                // Mark as seen after processing
                if (attrs && attrs.uid) {
                  this.imap.addFlags(attrs.uid, ['\\Seen'], { byUid: true }, (err) => {
                    if (err) console.error('Error marking email as seen:', err);
                  });
                }
              }
            } catch (error) {
              console.error('Error parsing email:', error);
            }
          });
        });
        
        f.once('error', (err) => console.error('Fetch error:', err));
      });
    });
  }
  
  end() {
    if (this.mailCheckInterval) {
      clearInterval(this.mailCheckInterval);
      this.mailCheckInterval = null;
    }
    if (this.imap) {
      this.imap.end();
      this.isConnected = false;
    }
  }

  fetchReplyEmails(onMail) {
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) throw err;
      this.imap.search(['ALL'], (err, results) => {
        if (err) throw err;
        if (!results || !results.length) {
          console.log('No emails found');
          return;
        }
        
        console.log(`Searching through ${results.length} emails for replies`);
        
        const f = this.imap.fetch(results, { 
          bodies: '',
          struct: true 
        });
        
        f.on('message', (msg, seqno) => {
          let buffer = '';
          
          msg.on('body', (stream, info) => {
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
          });
          
          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(buffer, {
                streamAttachments: false
              });
              if (parsed.inReplyTo || (parsed.references && parsed.references.length > 0)) {
                console.log(`Found reply email: ${parsed.subject}`);
                onMail(parsed);
              }
            } catch (error) {
              console.error('Error parsing email:', error);
            }
          });
        });
        
        f.once('error', (err) => console.log('Fetch error: ' + err));
        f.once('end', () => console.log('Finished searching for reply emails'));
      });
    });
  }

  fetchAllEmails(onMail, onComplete) {
    this.imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        console.error('Error opening INBOX:', err);
        if (onComplete) onComplete(err);
        return;
      }
      
      console.log(`INBOX opened. Total messages: ${box.messages.total}`);
      
      this.imap.search(['ALL'], (err, results) => {
        if (err) {
          console.error('Error searching emails:', err);
          if (onComplete) onComplete(err);
          return;
        }
        
        if (!results || !results.length) {
          console.log('No emails found');
          if (onComplete) onComplete(null);
          return;
        }
        
        console.log(`Found ${results.length} emails`);
        let processedCount = 0;
        
        const f = this.imap.fetch(results, { 
          bodies: '',
          struct: true 
        });
        
        f.on('message', (msg, seqno) => {
          let buffer = '';
          
          msg.on('body', (stream, info) => {
            stream.on('data', (chunk) => {
              buffer += chunk.toString('utf8');
            });
          });
          
          msg.once('end', async () => {
            try {
              const parsed = await simpleParser(buffer, {
                streamAttachments: false
              });
              
              console.log(`Parsed email ${seqno}: ${parsed.subject}`);
              if (parsed.attachments && parsed.attachments.length > 0) {
                console.log(`  Has ${parsed.attachments.length} attachments`);
              }
              
              onMail(parsed);
              processedCount++;
            } catch (error) {
              console.error(`Error parsing email ${seqno}:`, error);
            }
          });
        });
        
        f.once('error', (err) => {
          console.error('Fetch error:', err);
          if (onComplete) onComplete(err);
        });
        
        f.once('end', () => {
          console.log(`Finished fetching ${processedCount} emails`);
          if (onComplete) onComplete(null);
        });
      });
    });
  }
}

module.exports = ImapService;