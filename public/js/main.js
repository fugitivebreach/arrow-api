// Tab functionality for documentation and dashboard
function showTab(tabName) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Remove active class from all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => button.classList.remove('active'));
    
    // Show selected tab content
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked button
    const clickedButton = event ? event.target : document.querySelector(`[onclick="showTab('${tabName}')"]`);
    if (clickedButton) {
        clickedButton.classList.add('active');
    }
}

// Language tab functionality for documentation
function showLanguageTab(section, language) {
    // Hide all tab contents for this section
    const tabContents = document.querySelectorAll(`[id^="${section}-"]`);
    tabContents.forEach(content => content.classList.remove('active'));
    
    // Remove active class from all tab buttons in this section
    const tabButtons = event.target.parentElement.querySelectorAll('.tab-button');
    tabButtons.forEach(button => button.classList.remove('active'));
    
    // Show selected tab content
    const selectedTab = document.getElementById(`${section}-${language}`);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }
    
    // Add active class to clicked button
    if (event && event.target) {
        event.target.classList.add('active');
    }
}

// Dashboard functionality
function switchTab(tabName) {
    // Hide all tab panels
    const tabPanels = document.querySelectorAll('.tab-panel');
    tabPanels.forEach(panel => panel.classList.remove('active'));
    
    // Remove active class from all nav tabs
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => tab.classList.remove('active'));
    
    // Show selected tab panel
    const selectedPanel = document.getElementById(tabName);
    if (selectedPanel) {
        selectedPanel.classList.add('active');
    }
    
    // Add active class to corresponding nav tab
    const selectedNavTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (selectedNavTab) {
        selectedNavTab.classList.add('active');
    }
}

// API Key management
async function generateApiKey() {
    const nameInput = document.getElementById('keyName');
    const name = nameInput.value.trim() || 'New API Key';
    
    try {
        const response = await fetch('/dashboard/api-key/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ name })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('API key generated successfully!', 'success');
            nameInput.value = '';
            
            // Reload the page to show the new key
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } else {
            showAlert(data.error || 'Failed to generate API key', 'error');
        }
    } catch (error) {
        console.error('Error generating API key:', error);
        showAlert('Failed to generate API key', 'error');
    }
}

async function deleteApiKey(keyId) {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
        return;
    }
    
    try {
        const response = await fetch(`/dashboard/api-key/${keyId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('API key deleted successfully!', 'success');
            
            // Remove the key item from the DOM
            const keyItem = document.querySelector(`[data-key-id="${keyId}"]`);
            if (keyItem) {
                keyItem.remove();
            }
        } else {
            showAlert(data.error || 'Failed to delete API key', 'error');
        }
    } catch (error) {
        console.error('Error deleting API key:', error);
        showAlert('Failed to delete API key', 'error');
    }
}

function copyApiKey(key) {
    navigator.clipboard.writeText(key).then(() => {
        showAlert('API key copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy API key:', err);
        showAlert('Failed to copy API key', 'error');
    });
}


// Alert system
function showAlert(message, type = 'info') {
    // Remove existing alerts
    const existingAlerts = document.querySelectorAll('.alert-dynamic');
    existingAlerts.forEach(alert => alert.remove());
    
    // Create new alert
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dynamic`;
    alert.innerHTML = `
        <i class="fas fa-${getAlertIcon(type)}"></i>
        <span>${message}</span>
        <button class="alert-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add to page
    const container = document.querySelector('.dashboard-content') || document.querySelector('.container');
    if (container) {
        container.insertBefore(alert, container.firstChild);
    }
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

function getAlertIcon(type) {
    switch (type) {
        case 'success': return 'check-circle';
        case 'error': return 'exclamation-circle';
        case 'warning': return 'exclamation-triangle';
        default: return 'info-circle';
    }
}

// Navigation functionality
document.addEventListener('DOMContentLoaded', function() {
    // Dashboard tab navigation
    const navTabs = document.querySelectorAll('.nav-tab');
    navTabs.forEach(tab => {
        tab.addEventListener('click', function(e) {
            e.preventDefault();
            const tabName = this.getAttribute('data-tab');
            if (tabName) {
                switchTab(tabName);
            }
        });
    });
    
    // Documentation smooth scrolling
    const docLinks = document.querySelectorAll('.docs-nav a[href^="#"]');
    docLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
});


// Mobile menu toggle (if needed)
function toggleMobileMenu() {
    const navLinks = document.querySelector('.nav-links');
    if (navLinks) {
        navLinks.classList.toggle('mobile-open');
    }
}

// Utility function to format dates
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}

// Copy text to clipboard utility
function copyToClipboard(text) {
    if (navigator.clipboard) {
        return navigator.clipboard.writeText(text);
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return Promise.resolve();
    }
}

// Language switcher functionality
function toggleLanguageMenu() {
    const menu = document.getElementById('language-menu');
    if (menu) {
        menu.classList.toggle('show');
    }
}

function setLanguage(lang) {
    const currentLang = document.getElementById('current-language');
    const languages = {
        'en': 'English',
        'es': 'Español', 
        'fr': 'Français',
        'de': 'Deutsch',
        'ja': '日本語',
        'zh': '中文'
    };
    
    if (currentLang && languages[lang]) {
        currentLang.textContent = languages[lang];
    }
    toggleLanguageMenu();
    
    // Here you would implement actual language switching logic
    console.log('Language switched to:', lang);
}

// Dropdown functionality for sidebar navigation
function toggleDropdown(element) {
    const dropdown = element.parentElement;
    dropdown.classList.toggle('active');
    
    // Close other dropdowns
    const allDropdowns = document.querySelectorAll('.dropdown');
    allDropdowns.forEach(dd => {
        if (dd !== dropdown) {
            dd.classList.remove('active');
        }
    });
}

// Close language menu when clicking outside
document.addEventListener('click', function(event) {
    const languageSwitcher = document.querySelector('.language-switcher');
    const languageMenu = document.getElementById('language-menu');
    
    if (languageSwitcher && languageMenu && !languageSwitcher.contains(event.target)) {
        languageMenu.classList.remove('show');
    }
});
