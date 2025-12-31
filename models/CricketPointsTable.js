const mongoose = require("mongoose");

const teamSchema = new mongoose.Schema({
  teamName: { type: String, required: true },             // Team name (e.g., "Yash", "Naitik")
  matches: { type: Number, default: 0 },                  // Total matches played (M)
  wins: { type: Number, default: 0 },                     // Total wins (W)
  losses: { type: Number, default: 0 },                   // Total losses (L)
  points: { type: Number, default: 0 },                   // Total points (P)
  nrr: { type: Number, default: 0 },                      // Net Run Rate (NRR)
  position: { type: Number, default: 0 },                 // Position in the table
  // NRR calculation fields
  runsScored: { type: Number, default: 0 },               // Total runs scored
  runsConceded: { type: Number, default: 0 },             // Total runs conceded
  ballsFaced: { type: Number, default: 0 },               // Total balls faced (for overs calculation)
  ballsBowled: { type: Number, default: 0 },              // Total balls bowled (for overs calculation)
}, { _id: true });

const cricketPointsTableSchema = new mongoose.Schema({
  guildId: { type: String, required: true },              // Guild ID for the server
  tournamentName: { type: String, default: "Tournament" }, // Tournament name
  teams: [teamSchema],                                    // Array of teams
  qualifyCount: { type: Number, default: 2 },             // Number of teams that qualify
  createdAt: { type: Date, default: Date.now },           // When the table was created
  updatedAt: { type: Date, default: Date.now },           // When the table was last updated
});

// Update the updatedAt field before saving
cricketPointsTableSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Method to sort teams by points and NRR
cricketPointsTableSchema.methods.sortTeams = function() {
  this.teams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.nrr - a.nrr;
  });
  
  // Update positions
  this.teams.forEach((team, index) => {
    team.position = index + 1;
  });
};

module.exports = mongoose.model("CricketPointsTable", cricketPointsTableSchema);
