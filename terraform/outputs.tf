output "ec2_public_ip" {
  value       = aws_instance.app_server.public_ip
  description = "The public IP address of the deployed EC2 server."
}

output "postgres_endpoint" {
  value       = aws_db_instance.postgres.endpoint
  description = "Connection endpoint for the RDS PostgreSQL database."
}

output "redis_endpoint" {
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
  description = "Connection address of the ElastiCache Redis nodes."
}
