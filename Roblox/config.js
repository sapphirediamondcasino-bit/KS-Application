// Roblox API Configuration
const ROBLOX_CONFIG = {
    // API Endpoints
    endpoints: {
        trades: 'https://trades.roblox.com/v1',
        inventory: 'https://inventory.roblox.com/v1',
        economy: 'https://economy.roblox.com/v1',
        users: 'https://users.roblox.com/v1'
    },
    
    // Rate limiting
    rateLimit: {
        requestsPerMinute: 60,
        retryDelay: 1000
    },
    
    // Trading settings
    trading: {
        maxItemsPerTrade: 4,
        tradeStatuses: {
            pending: 'Pending',
            completed: 'Completed',
            declined: 'Declined',
            expired: 'Expired'
        }
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ROBLOX_CONFIG;
}