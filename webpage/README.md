# AITerminal - Modern AI Startup Landing Page

A modern, stylish landing page for an AI startup with a retro terminal feel. Built with vanilla HTML, CSS, and JavaScript, served with Node.js.

## Features

- 🖥️ Retro terminal aesthetic with modern design
- ⚡ Interactive terminal commands
- 🎨 Glitch text effects and animations
- 📊 Animated statistics counters
- 💚 Monochrome green color scheme
- 📱 Fully responsive design

## Getting Started

### Prerequisites

- Node.js (v12.0.0 or higher)

### Installation

1. Navigate to the webpage directory:
   ```bash
   cd /Users/User/Desktop/MCP2/webpage
   ```

2. Run the server:
   ```bash
   node server.js
   ```
   
   Or using npm:
   ```bash
   npm start
   ```

3. Open your browser and visit:
   ```
   http://localhost:3000
   ```

## Interactive Features

The terminal interface supports several commands:
- `request_demo` - Request a product demo
- `view_docs` - View documentation
- `show_privacy` - Display privacy policy
- `show_terms` - Show terms of service
- `contact_us` - Get contact information

You can also type your own commands in the terminal!

## File Structure

```
webpage/
├── index.html      # Main HTML file
├── styles.css      # CSS styles with terminal theme
├── script.js       # JavaScript for interactivity
├── server.js       # Node.js HTTP server
├── favicon.svg     # Terminal-style favicon
├── package.json    # Node.js package configuration
└── README.md       # This file
```

## Technologies Used

- HTML5
- CSS3 (with animations and grid layout)
- JavaScript (vanilla)
- Node.js (for the server)
- Google Fonts (Source Code Pro)

## Customization

Feel free to modify:
- ASCII art in the logo section
- Statistics and their animations
- Terminal commands and responses
- Color scheme (currently using green terminal theme)
- Feature boxes and content

## Running in Production

For production deployment, consider:
- Using a process manager like PM2
- Setting up HTTPS with SSL certificates
- Implementing proper error logging
- Adding environment variables for configuration

## License

This project is for educational purposes. Feel free to use and modify as needed.
