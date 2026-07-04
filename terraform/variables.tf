variable "aws_region" {
  type        = string
  default     = "us-east-1"
  description = "The target AWS region to deploy infrastructure resources."
}

variable "db_password" {
  type        = string
  sensitive   = true
  description = "Password for the RDS PostgreSQL administrator database account."
}

variable "admin_ip_cidr" {
  type        = string
  default     = "0.0.0.0/0"
  description = "CIDR range allowed to access EC2 instances via SSH ports."
}

variable "ssh_key_name" {
  type        = string
  default     = "scheduler-ssh-key"
  description = "Name of the SSH key pair registered in AWS to access instances."
}

variable "ec2_ami_id" {
  type        = string
  default     = "ami-0440d3b780d96b29d" # Amazon Linux 2023 AMI in us-east-1
  description = "AMI ID used to launch host servers."
}
