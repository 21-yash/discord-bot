const { createCanvas } = require('canvas');

/**
 * Generates a points table image
 * @param {Object} pointsTable - The points table data from MongoDB
 * @returns {Buffer} - PNG image buffer
 */
async function generatePointsTable(pointsTable) {
    const teams = pointsTable.teams;
    const qualifyCount = pointsTable.qualifyCount;
    
    // Dimensions
    const rowHeight = 50;
    const headerHeight = 60;
    const footerHeight = 45;
    const padding = 20;
    const width = 550;
    const height = headerHeight + (teams.length * rowHeight) + footerHeight + (padding * 2);
    
    // Column positions
    const columns = {
        teamName: { x: 30, width: 180 },
        matches: { x: 220, width: 50 },
        wins: { x: 270, width: 50 },
        losses: { x: 320, width: 50 },
        points: { x: 370, width: 50 },
        nrr: { x: 420, width: 100 }
    };
    
    // Create canvas
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    
    // Background - Discord dark theme
    ctx.fillStyle = '#2b2d31';
    ctx.fillRect(0, 0, width, height);
    
    // Title background
    ctx.fillStyle = '#1e1f22';
    ctx.fillRect(0, 0, width, headerHeight);
    
    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 22px Arial';
    ctx.fillText(`🏏 Points Table (${pointsTable.tournamentName})`, 25, 38);
    
    // Header row background
    const headerY = headerHeight;
    ctx.fillStyle = '#383a40';
    ctx.fillRect(0, headerY, width, rowHeight - 5);
    
    // Header text
    ctx.fillStyle = '#b5bac1';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Team Name', columns.teamName.x, headerY + 32);
    ctx.fillText('M', columns.matches.x + 15, headerY + 32);
    ctx.fillText('W', columns.wins.x + 15, headerY + 32);
    ctx.fillText('L', columns.losses.x + 15, headerY + 32);
    ctx.fillText('P', columns.points.x + 15, headerY + 32);
    ctx.fillText('NRR', columns.nrr.x + 20, headerY + 32);
    
    // Draw teams
    let currentY = headerHeight + rowHeight - 5;
    
    for (let i = 0; i < teams.length; i++) {
        const team = teams[i];
        const isQualifying = i < qualifyCount;
        
        // Row background - alternate colors
        if (i % 2 === 0) {
            ctx.fillStyle = '#2b2d31';
        } else {
            ctx.fillStyle = '#313338';
        }
        ctx.fillRect(0, currentY, width, rowHeight);
        
        // Qualifying indicator (left border)
        if (isQualifying) {
            ctx.fillStyle = '#57f287';
            ctx.fillRect(0, currentY, 4, rowHeight);
        }
        
        // Team name
        ctx.fillStyle = '#ffffff';
        ctx.font = '16px Arial';
        ctx.fillText(team.teamName, columns.teamName.x, currentY + 32);
        
        // Stats
        ctx.fillStyle = '#dbdee1';
        ctx.font = '15px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(team.matches.toString(), columns.matches.x + 25, currentY + 32);
        ctx.fillText(team.wins.toString(), columns.wins.x + 25, currentY + 32);
        ctx.fillText(team.losses.toString(), columns.losses.x + 25, currentY + 32);
        
        // Points - bold
        ctx.font = 'bold 15px Arial';
        ctx.fillText(team.points.toString(), columns.points.x + 25, currentY + 32);
        
        // NRR - with color coding
        ctx.font = '15px Arial';
        const nrrValue = team.nrr.toFixed(2);
        if (team.nrr > 0) {
            ctx.fillStyle = '#57f287'; // Green for positive
            ctx.fillText(`+${nrrValue}`, columns.nrr.x + 40, currentY + 32);
        } else if (team.nrr < 0) {
            ctx.fillStyle = '#ed4245'; // Red for negative
            ctx.fillText(nrrValue, columns.nrr.x + 40, currentY + 32);
        } else {
            ctx.fillStyle = '#dbdee1';
            ctx.fillText('0.00', columns.nrr.x + 40, currentY + 32);
        }
        
        ctx.textAlign = 'left';
        currentY += rowHeight;
    }
    
    // Footer
    ctx.fillStyle = '#1e1f22';
    ctx.fillRect(0, currentY, width, footerHeight);
    
    // Qualifying text
    ctx.fillStyle = '#57f287';
    ctx.fillRect(25, currentY + 15, 12, 12);
    ctx.fillStyle = '#b5bac1';
    ctx.font = '13px Arial';
    ctx.fillText(`Top ${qualifyCount} Players Will Qualify`, 45, currentY + 26);
    
    // Tournament name
    ctx.fillStyle = '#80848e';
    ctx.font = '12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(pointsTable.tournamentName || 'Tournament', width - 25, currentY + 26);
    
    return canvas.toBuffer('image/png');
}

module.exports = { generatePointsTable };
