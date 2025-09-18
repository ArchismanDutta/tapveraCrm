# Check current S3 website configuration
aws s3api get-bucket-website --bucket tapvera-crm-frontend

# If the above fails, check if static hosting is enabled
aws s3api get-bucket-website --bucket tapvera-crm-frontend 2>&1 | grep -i "error\|not found"

# List bucket contents to verify index.html exists
aws s3 ls s3://tapvera-crm-frontend/ --recursive | grep index.html
