// This script will help generate a placeholder logo for the AskBot
// To generate the logo, simply run this script in Node.js with Canvas installed:
// npm install canvas
// node logo_generator.js

const fs = require('fs');
const { createCanvas } = require('canvas');

// Create a canvas for our logo
const canvas = createCanvas(400, 400);
const ctx = canvas.getContext('2d');

// Fill the background
ctx.fillStyle = 'transparent';
ctx.fillRect(0, 0, 400, 400);

// Draw the robot body (red color)
ctx.fillStyle = '#800000'; // DHVSU maroon color
ctx.beginPath();

// Robot head
ctx.arc(200, 140, 50, 0, Math.PI * 2);
ctx.fill();

// Robot body
ctx.fillStyle = '#800000';
ctx.beginPath();
ctx.roundRect(125, 180, 150, 120, 20);
ctx.fill();

// Robot antenna
ctx.fillStyle = '#800000';
ctx.beginPath();
ctx.roundRect(190, 80, 20, 40, 5);
ctx.fill();
ctx.beginPath();
ctx.arc(200, 70, 15, 0, Math.PI * 2);
ctx.fill();

// Robot ears/sides
ctx.fillStyle = '#800000';
ctx.beginPath();
ctx.roundRect(90, 150, 25, 50, 10);
ctx.fill();
ctx.beginPath();
ctx.roundRect(285, 150, 25, 50, 10);
ctx.fill();

// Add details
// Eyes (gold)
ctx.fillStyle = '#FFD700'; // DHVSU gold color
ctx.beginPath();
ctx.arc(170, 140, 15, 0, Math.PI * 2);
ctx.fill();
ctx.beginPath();
ctx.arc(230, 140, 15, 0, Math.PI * 2);
ctx.fill();

// Mouth/speaker
ctx.fillStyle = '#FFD700';
ctx.beginPath();
ctx.roundRect(180, 220, 40, 20, 5);
ctx.fill();

// Add H letter for Honorian
ctx.fillStyle = '#FFD700';
ctx.font = 'bold 60px Arial';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('H', 200, 240);

// Add a border to the robot
ctx.strokeStyle = '#5e0000';
ctx.lineWidth = 8;
ctx.beginPath();
ctx.arc(200, 140, 50, 0, Math.PI * 2);
ctx.stroke();
ctx.beginPath();
ctx.roundRect(125, 180, 150, 120, 20);
ctx.stroke();

// Add inner details to make it look more like a robot
ctx.strokeStyle = '#5e0000';
ctx.lineWidth = 3;
ctx.beginPath();
ctx.roundRect(145, 200, 110, 80, 10);
ctx.stroke();

// Save the image
const buffer = canvas.toBuffer('image/png');
fs.writeFileSync('askbot_logo.png', buffer);

console.log('Logo generated successfully as askbot_logo.png'); 