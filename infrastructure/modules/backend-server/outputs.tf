output "instance_id" {
  value = aws_instance.web.id
}

output "public_ip" {
  description = "Elastic IP attached to the instance"
  value       = aws_eip.web.public_ip
}

output "key_name" {
  value = aws_key_pair.main.key_name
}
