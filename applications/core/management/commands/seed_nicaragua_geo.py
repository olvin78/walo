from django.core.management.base import BaseCommand
from django.utils.text import slugify

from applications.core.geo_data import DEPARTMENTS
from applications.core.models import City, Department


class Command(BaseCommand):
    help = "Siembra los 17 departamentos y 153 municipios de Nicaragua (idempotente)."

    def handle(self, *args, **options):
        created_depts = 0
        created_cities = 0
        for dept_data in DEPARTMENTS:
            department, created = Department.objects.get_or_create(
                slug=dept_data["slug"],
                defaults={"name": dept_data["name"]},
            )
            if created:
                created_depts += 1
                self.stdout.write(f"Departamento creado: {department.name}")
            for city_name in dept_data["cities"]:
                city, created = City.objects.get_or_create(
                    slug=slugify(city_name),
                    defaults={
                        "name": city_name,
                        "department": department,
                    },
                )
                if created:
                    created_cities += 1
                    self.stdout.write(f"  Municipio creado: {city_name}")
        self.stdout.write(
            self.style.SUCCESS(
                f"Seed completo: {created_depts} departamentos y {created_cities} municipios creados."
            )
        )
