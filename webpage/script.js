// Animate stats numbers
function animateStats() {
    const statNumbers = document.querySelectorAll('.stat-number');
    
    statNumbers.forEach(stat => {
        const target = parseFloat(stat.getAttribute('data-target'));
        const duration = 2000; // 2 seconds
        const increment = target / (duration / 16); // 60 FPS
        let current = 0;
        
        const timer = setInterval(() => {
            current += increment;
            if (current >= target) {
                current = target;
                clearInterval(timer);
            }
            
            // Format number based on whether it's a decimal
            if (target % 1 === 0) {
                stat.textContent = Math.floor(current);
            } else {
                stat.textContent = current.toFixed(1);
            }
        }, 16);
    });
}

// Type command in the terminal
function typeCommand(command) {
    const userInput = document.getElementById('user-input');
    userInput.textContent = '';
    
    let i = 0;
    const typing = setInterval(() => {
        if (i < command.length) {
            userInput.textContent += command[i];
            i++;
        } else {
            clearInterval(typing);
            
            // Simulate command execution
            setTimeout(() => {
                executeCommand(command);
            }, 500);
        }
    }, 50);
}

// Execute terminal commands
function executeCommand(command) {
    const terminalContent = document.querySelector('.terminal-content');
    const newLine = document.createElement('div');
    newLine.className = 'terminal-line';
    newLine.innerHTML = `<span class="prompt">$</span> <span class="command">${command}</span>`;
    
    const cursor = document.querySelector('.cursor');
    terminalContent.insertBefore(newLine, cursor.parentElement);
    
    // Add command output
    const output = document.createElement('div');
    output.className = 'terminal-output';
    
    switch(command) {
        case 'request_demo':
            output.innerHTML = '<p>Starting demo request process...</p><p><span class="green">[OK]</span> Opening contact form...</p>';
            setTimeout(() => {
                alert('Demo request form would open here in a real application!');
            }, 1000);
            break;
            
        case 'view_docs':
            output.innerHTML = '<p>Loading documentation...</p><p><span class="green">[OK]</span> Redirecting to docs...</p>';
            setTimeout(() => {
                alert('Documentation would open here in a real application!');
            }, 1000);
            break;
            
        case 'show_privacy':
            output.innerHTML = '<p>Loading privacy policy...</p><p><span class="green">[OK]</span> Privacy policy loaded.</p>';
            break;
            
        case 'show_terms':
            output.innerHTML = '<p>Loading terms of service...</p><p><span class="green">[OK]</span> Terms loaded.</p>';
            break;
            
        case 'contact_us':
            output.innerHTML = '<p>Contact information:</p><p>Email: hello@aiterminal.ai</p><p>Phone: +1 (555) 123-4567</p>';
            break;
            
        default:
            output.innerHTML = `<p><span class="red">Error:</span> Command not found: ${command}</p>`;
    }
    
    terminalContent.insertBefore(output, cursor.parentElement);
    
    // Clear user input
    document.getElementById('user-input').textContent = '';
    
    // Scroll to bottom
    window.scrollTo(0, document.body.scrollHeight);
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    // Start stats animation when they come into view
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateStats();
                observer.unobserve(entry.target);
            }
        });
    });
    
    const statsContainer = document.querySelector('.stats-container');
    if (statsContainer) {
        observer.observe(statsContainer);
    }
    
    // Add cursor blinking effect
    const cursor = document.querySelector('.cursor');
    setInterval(() => {
        cursor.style.opacity = cursor.style.opacity === '0' ? '1' : '0';
    }, 500);
    
    // Listen for keyboard input
    document.addEventListener('keypress', (e) => {
        const userInput = document.getElementById('user-input');
        if (e.key === 'Enter' && userInput.textContent) {
            executeCommand(userInput.textContent);
        } else if (e.key !== 'Enter') {
            userInput.textContent += e.key;
        }
    });
    
    // Handle backspace
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            const userInput = document.getElementById('user-input');
            userInput.textContent = userInput.textContent.slice(0, -1);
        }
    });
});

// Add random glitch effect
setInterval(() => {
    const glitchElement = document.querySelector('.glitch');
    if (glitchElement && Math.random() > 0.95) {
        glitchElement.style.animation = 'none';
        setTimeout(() => {
            glitchElement.style.animation = '';
        }, 50);
    }
}, 1000);
