# Delta SPMU Academy

E-learning platform for permanent makeup (SPMU) training. Based in Addis Ababa, Ethiopia.

## Platform Components

| Component | Location | Hosting |
|-----------|----------|---------|
| Marketing Site | `./` (root) | S3 + CloudFront |
| Student Portal | `frontend/student-portal/` | Vercel |
| Admin Portal | `frontend/admin-portal/` | Vercel |
| Backend API | `backend/frappe-lms/` | EC2 (Frappe) |
| Infrastructure | `infrastructure/` | Terraform (AWS) |

## Courses

1. **Foundation Certification** — Core basics: infection control, brow mapping, safe machine handling
2. **Advanced Certification** — Nano hairstrokes, shading gradients, complex case management
3. **Master Artist Program** — Precision, corrective work, industry leadership
4. **Instructor Licensing** — Train to become an educator

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS 4
- **Backend**: Frappe v15 + LMS app (Python)
- **Database**: MariaDB 10.11 (AWS RDS)
- **Video**: Vimeo
- **Payments**: telebirr, Chapa, EthSwitch, CBE
- **Infrastructure**: AWS (EC2, RDS, S3, CloudFront, Lambda)

## Getting Started

### Marketing Site (already built)
```bash
npm install
npm run dev
```

### Student Portal
```bash
cd frontend/student-portal
npm install
npm run dev
```

### Admin Portal
```bash
cd frontend/admin-portal
npm install
npm run dev
```

## Documentation

- [Build Guide](DELTA_SPMU_BUILD_GUIDE.md) — Complete architecture and build reference
- [Architecture Overview](docs/ARCHITECTURE_OVERVIEW.md)
- [Deployment Guide](docs/DEPLOYMENT_GUIDE.md)
- [Payment Integration](docs/PAYMENT_INTEGRATION.md)
