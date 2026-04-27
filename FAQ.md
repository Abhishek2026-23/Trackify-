# Frequently Asked Questions

## General

**Q: What is this system for?**
A: Real-time bus tracking for Tier-2 cities in India to help commuters track buses and see arrival times.

**Q: Who is this for?**
A: Commuters, municipal transport authorities, and local transport operators.

**Q: Is this production-ready?**
A: Yes, designed for production with scalability, security, and performance in mind.

## Technical

**Q: What technologies are used?**
A: Node.js, Express, PostgreSQL, Redis, React, React Native, Socket.io, Leaflet.

**Q: How many buses can it handle?**
A: Designed for 500+ buses with horizontal scaling capabilities.

**Q: Does it work offline?**
A: Mobile app has basic offline support for cached data. Real-time features require internet.

**Q: What about low bandwidth areas?**
A: Optimized for low bandwidth with compression, caching, and minimal payloads (~2-3KB/min).

## Setup

**Q: What are the system requirements?**
A: Node.js 18+, PostgreSQL 14+, Redis 7+, 2GB RAM minimum.

**Q: How long does setup take?**
A: About 5-10 minutes following the Quick Start guide.

**Q: Can I use Docker?**
A: Yes, Docker Compose configuration is included.

**Q: How do I test without GPS devices?**
A: Use the included GPS simulator script.

## Features

**Q: How accurate is the ETA?**
A: Based on current speed and distance. Accuracy improves with traffic data integration.

**Q: Can users get notifications?**
A: Push notifications are planned for Phase 2.

**Q: Is there a driver app?**
A: Planned for Phase 3. Currently GPS devices send location data.

**Q: Can I track multiple routes?**
A: Yes, the system supports unlimited routes.

## Deployment

**Q: What cloud platforms are supported?**
A: AWS, Azure, GCP, DigitalOcean, or any VPS with Docker support.

**Q: What's the estimated cost?**
A: ~$235/month on AWS for 500 buses (see SCALABILITY.md).

**Q: How do I scale for more buses?**
A: Horizontal scaling with load balancer, Redis cluster, and database replicas.

## Security

**Q: Is the API secure?**
A: Yes, with JWT authentication, rate limiting, input validation, and HTTPS in production.

**Q: How is user data protected?**
A: Bcrypt password hashing, encrypted connections, no sensitive data in logs.

## Support

**Q: Where can I get help?**
A: Check documentation files or create an issue on GitHub.

**Q: Can I contribute?**
A: Yes! See CONTRIBUTING.md for guidelines.

**Q: Is there a demo?**
A: Run locally with GPS simulator for a full demo.
