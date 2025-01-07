module.exports = {
  '**/*.{js,jsx,ts,tsx}': [
    'prettier --write',
    'eslint --fix',
  ],
  '**/*.{json,css,scss,md}': [
    'prettier --write',
  ],
} 