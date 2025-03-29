#!/bin/bash
echo "Building application..."
cd gemini-frontend
npm install
npm run build
echo "Build completed!"