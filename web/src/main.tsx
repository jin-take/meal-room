import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { installIssue20Enhancements } from './issue20';
import './styles.css';
import './issue7.css';
import './issues-8-13.css';
import './issue20.css';

installIssue20Enhancements();

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
