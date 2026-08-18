# DevBox Backend — multi-stage build
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

# Copy Maven wrapper and pom first for dependency caching
COPY mvnw mvnw.cmd pom.xml ./
COPY .mvn .mvn

# Download dependencies
RUN ./mvnw dependency:go-offline -q

# Copy source and build (skip tests — run separately)
COPY src ./src
RUN ./mvnw package -DskipTests -q

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY --from=build /app/target/backend-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
