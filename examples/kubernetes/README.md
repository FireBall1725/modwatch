# Modwatch on Kubernetes

The default here runs Modwatch against a Postgres cluster from the [CloudNativePG](https://cloudnative-pg.io) operator. It needs the operator installed, an ingress controller, and a StorageClass.

## Steps

1. Create the secret with your keys. Use your own secret tool if you have one, such as Sealed Secrets or External Secrets.

   ```sh
   kubectl create namespace modwatch
   kubectl -n modwatch create secret generic modwatch-keys \
     --from-literal=curseforge-api-key='<your Core API key>' \
     --from-literal=curseforge-author-id='<your numeric author id>'
   ```

   The Modrinth and GitHub keys are optional. Add `modrinth-user`, `modrinth-token` and `github-token` the same way, or set them on the Settings page. A value set on the Settings page wins over the secret.

2. Change the ingress host and class in `ingress.yaml`, and the storage size or class in `cnpg-cluster.yaml`.

3. Apply it.

   ```sh
   kubectl apply -k .
   ```

The dashboard answers at your ingress host once the database is ready, which takes a minute on a first install. Modwatch creates its own tables on start.

## Prometheus

`servicemonitor.yaml` scrapes `/metrics` for the Prometheus Operator. Add it to `kustomization.yaml` to use it.

## SQLite instead of Postgres

SQLite needs no operator. Swap the database like this:

1. Replace `cnpg-cluster.yaml` with `sqlite-pvc.yaml` in `kustomization.yaml`.
2. In `deployment.yaml`, set `DATABASE_URL` to a plain value and mount the volume. The container's `readOnlyRootFilesystem` stays on, because the file lives on the volume.

   ```yaml
   env:
     - name: DATABASE_URL
       value: sqlite:///data/modwatch.db
   ```

   ```yaml
   volumeMounts:
     - name: data
       mountPath: /data
   ```

   ```yaml
   volumes:
     - name: data
       persistentVolumeClaim:
         claimName: modwatch-data
   ```

   The pod already runs as user 65532. Add `fsGroup: 65532` to the pod's `securityContext` so the volume is writable by it.

Keep `replicas: 1` and the `Recreate` strategy. SQLite is one file, so two pods must never open it at once.

A database isn't converted from one kind to the other. Pick one before the history builds up.
