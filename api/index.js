import serverless from 'serverless-http';
import app from '../lib/server.js';

export default serverless(app);
