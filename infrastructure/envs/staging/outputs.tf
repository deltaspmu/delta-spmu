output "ec2_public_ip" {
  description = "Staging server Elastic IP — point staging-api.deltaspmu.com here and set EC2_HOST in scripts/env/staging.env"
  value       = module.backend_server.public_ip
}

output "ec2_instance_id" {
  value = module.backend_server.instance_id
}

output "vpc_id" {
  value = module.network.vpc_id
}

output "web_security_group_id" {
  value = module.network.web_sg_id
}

output "ssh_command" {
  value = "ssh ubuntu@${module.backend_server.public_ip}"
}
