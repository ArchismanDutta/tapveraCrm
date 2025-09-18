# S3 Routing Fix Commands

# 1. Enable static website hosting
aws s3 website s3://tapvera-crm-frontend --index-document index.html --error-document index.html

# 2. Set bucket policy to allow public read access
aws s3api put-bucket-policy --bucket tapvera-crm-frontend --policy '{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "tapvera-crm-frontend/*"
    }
  ]
}'

# 3. Upload your built React app
aws s3 sync ./client/dist s3://tapvera-crm-frontend --delete

# 4. Set proper content types for HTML files
aws s3 cp s3://tapvera-crm-frontend/index.html s3://tapvera-crm-frontend/index.html --content-type "text/html" --metadata-directive REPLACE
