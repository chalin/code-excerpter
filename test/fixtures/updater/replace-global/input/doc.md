# Replace Order

Global replace runs after file-level and fragment-level replacements.

<?code-excerpt replace="/bonjour/hola/g"?>

<?code-excerpt "basic.dart" replace="/hello/bonjour/g;/world/mundo/g"?>

```
old
```

Resetting the file-level replace leaves only the fragment replace.

<?code-excerpt replace=""?>
<?code-excerpt "basic.dart" replace="/hello/bonjour/g"?>

```
old
```
