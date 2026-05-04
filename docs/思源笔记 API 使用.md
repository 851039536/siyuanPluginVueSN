- 公开API：稳定性高，变更会确保向后兼容。（[来源](https://github.com/siyuan-note/siyuan/blob/master/API_zh_CN.md)）
- 未公开API：稳定性低，可能随时改动，不保证向后兼容。（[来源](https://github.com/siyuan-note/siyuan/blob/master/kernel/api/router.go)）


## 规范

#### 请求与响应

- 端点：`http://127.0.0.1:6806`
- **方法**：POST
- 参数：JSON 字符串，置于请求体，Content-Type: application/json
- **响应格式**：

```js
{
  "code": 0,    // 非0表示异常
  "msg": "",    // 异常时返回错误信息
  "data": {}    // 接口返回数据，可能为 {}、[] 或 null
}
```

#### 鉴权 SyToken

在 `设置 - 关于` 中查看 API token。
请求头需包含：`Authorization: Token <你的token>`

## 笔记本

### 列出笔记本

- `/api/notebook/lsNotebooks`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "notebooks": [
        {
          "id": "20210817205410-2kvfpfn",
          "name": "测试笔记本",
          "icon": "1f41b",
          "sort": 0,
          "closed": false
        }
      ]
    }
  }
  ```

### 打开笔记本

- `/api/notebook/openNotebook`
- `{"notebook": "笔记本ID"}`

### 关闭笔记本

- `/api/notebook/closeNotebook`
- `{"notebook": "笔记本ID"}`

### 重命名笔记本

- `/api/notebook/renameNotebook`
- **参数**：`{"notebook": "笔记本ID", "name": "新名称"}`

### 创建笔记本

- `/api/notebook/createNotebook`
- **参数**：`{"name": "笔记本名称"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "notebook": {
        "id": "20220126215949-r1wvoch",
        "name": "笔记本的名称",
        "icon": "",
        "sort": 0,
        "closed": false
      }
    }
  }
  ```

### 删除笔记本

- `/api/notebook/removeNotebook`
- **参数**：`{"notebook": "笔记本ID"}`

### 获取笔记本配置

- `/api/notebook/getNotebookConf`
- **参数**：`{"notebook": "笔记本ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "box": "20210817205410-2kvfpfn",
      "conf": {
        "name": "测试笔记本",
        "closed": false,
        "refCreateSavePath": "",
        "createDocNameTemplate": "",
        "dailyNoteSavePath": "/daily note/{{now | date \"2006/01\"}}/{{now | date \"2006-01-02\"}}",
        "dailyNoteTemplatePath": ""
      },
      "name": "测试笔记本"
    }
  }
  ```

### 保存笔记本配置

- `/api/notebook/setNotebookConf`
- 参数

  ```json
  {
    "notebook": "20210817205410-2kvfpfn",
    "conf": {
      "name": "测试笔记本",
      "closed": false,
      "refCreateSavePath": "",
      "createDocNameTemplate": "",
      "dailyNoteSavePath": "/daily note/{{now | date \"2006/01\"}}/{{now | date \"2006-01-02\"}}",
      "dailyNoteTemplatePath": ""
    }
  }
  ```

  - `notebook`：笔记本 ID
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "name": "测试笔记本",
      "closed": false,
      "refCreateSavePath": "",
      "createDocNameTemplate": "",
      "dailyNoteSavePath": "/daily note/{{now | date \"2006/01\"}}/{{now | date \"2006-01-02\"}}",
      "dailyNoteTemplatePath": ""
    }
  }
  ```


## 文档

### 通过 Markdown 创建文档

- `/api/filetree/createDocWithMd`
- **参数**：`{"notebook": "笔记本ID", "path": "/文档路径", "markdown": "GFM Markdown 内容"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": "20210914223645-oj2vnx2"
  }
  ```
- **返回**：`data` 为新文档 ID。同一 `path` 重复调用不会覆盖。

### 重命名文档

- `/api/filetree/renameDoc`
- 参数：`{"notebook": "笔记本ID", "path": "文档路径", "title": "新标题"}`

### 通过 `id` 重命名文档：

- `/api/filetree/renameDocByID`
- **参数**：`{"id": "文档ID", "title": "新标题"}`

### 删除文档

- `/api/filetree/removeDoc`
- `{"notebook": "笔记本ID", "path": "文档路径"}`

### 通过 `id` 删除文档：

- `/api/filetree/removeDocByID`
- `{"id": "文档ID"}`

### 移动文档

- `/api/filetree/moveDocs`
- `{"fromPaths": ["源路径"], "toNotebook": "目标笔记本ID", "toPath": "目标路径"}`

### 通过 `id` 移动文档：

- `/api/filetree/moveDocsByID`
- **参数**：`{"fromIDs": ["源文档ID"], "toID": "目标父文档ID"}`

### 根据路径获取人类可读路径

- `/api/filetree/getHPathByPath`
- 参数

  ```json
  {
    "notebook": "20210831090520-7dvbdv0",
    "path": "/20210917220500-sz588nq/20210917220056-yxtyl7i.sy"
  }
  ```

  - `notebook`：笔记本 ID
  - `path`：路径
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": "/foo/bar"
  }
  ```

### 根据 ID 获取人类可读路径

- `/api/filetree/getHPathByID`
- **参数**：`{"id": "块ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": "/foo/bar"
  }
  ```

### 根据 ID 获取存储路径

- `/api/filetree/getPathByID`
- **参数**：`{"id": "块ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "notebook": "20210808180117-czj9bvb",
      "path": "/20200812220555-lj3enxa/20210808180320-fqgskfj.sy"
    }
  }
  ```

### 根据人类可读路径获取 IDs

- `/api/filetree/getIDsByHPath`
- **参数**：`{"path": "人类可读路径", "notebook": "笔记本ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": [
      "20200813004931-q4cu8na"
    ]
  }
  ```

### 追加内容到日记

- /api/block/appendDailyNoteBlock
- **参数**：`{"dataType": "markdown", "data": "内容", "notebook": "笔记本ID"}`
- POST

## 资源文件

### 上传资源文件

- `/api/asset/upload`
- **方法：** HTTP Multipart 表单

  - `assetsDirPath`：以 data 文件夹作为根路径，资源文件存放的文件夹路径。

    - `"/assets/"`：工作空间/data/assets/ 文件夹
    - `"/assets/sub/"`：工作空间/data/assets/sub/ 文件夹
  - `file[]`：上传的文件列表
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "errFiles": [""],
      "succMap": {
        "foo.png": "assets/foo-20210719092549-9j5y79r.png"
      }
    }
  }
  ```

  - `errFiles`：处理时遇到错误的文件名
  - `succMap`：处理成功的文件，key 为上传时的文件名，value 为 assets/foo-id.png，用于将已有 Markdown 内容中的资源文件链接地址替换为上传后的地址

## 块

### 插入块

- `/api/block/insertBlock`
- **参数**：`{"dataType": "markdown", "data": "插入内容", "nextID": "后一块ID", "previousID": "前一块ID", "parentID": "父块ID"}` // 三参数至少一个，优先级：nextID \> previousID \> parentID
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": [
      {
        "doOperations": [
          {
            "action": "insert",
            "data": "<div data-node-id=\"20211230115020-g02dfx0\" data-node-index=\"1\" data-type=\"NodeParagraph\" class=\"p\"><div contenteditable=\"true\" spellcheck=\"false\">foo<strong style=\"color: var(--b3-font-color8);\">bar</strong>baz</div><div class=\"protyle-attr\" contenteditable=\"false\"></div></div>",
            "id": "20211230115020-g02dfx0",
            "parentID": "",
            "previousID": "20211229114650-vrek5x6",
            "retData": null
          }
        ],
        "undoOperations": null
      }
    ]
  }
  ```

### 插入前置子块

- `/api/block/prependBlock`
- **参数**：`{"dataType": "markdown", "data": "内容", "parentID": "父块ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": [
      {
        "doOperations": [
          {
            "action": "insert",
            "data": "<div data-node-id=\"20220108003710-hm0x9sc\" data-node-index=\"1\" data-type=\"NodeParagraph\" class=\"p\"><div contenteditable=\"true\" spellcheck=\"false\">foo<strong style=\"color: var(--b3-font-color8);\">bar</strong>baz</div><div class=\"protyle-attr\" contenteditable=\"false\"></div></div>",
            "id": "20220108003710-hm0x9sc",
            "parentID": "20220107173950-7f9m1nb",
            "previousID": "",
            "retData": null
          }
        ],
        "undoOperations": null
      }
    ]
  }
  ```

### 插入后置子块

- `/api/block/appendBlock`
- **参数**：`{"dataType": "markdown", "data": "内容", "parentID": "父块ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": [
      {
        "doOperations": [
          {
            "action": "insert",
            "data": "<div data-node-id=\"20220108003642-y2wmpcv\" data-node-index=\"1\" data-type=\"NodeParagraph\" class=\"p\"><div contenteditable=\"true\" spellcheck=\"false\">foo<strong style=\"color: var(--b3-font-color8);\">bar</strong>baz</div><div class=\"protyle-attr\" contenteditable=\"false\"></div></div>",
            "id": "20220108003642-y2wmpcv",
            "parentID": "20220107173950-7f9m1nb",
            "previousID": "20220108003615-7rk41t1",
            "retData": null
          }
        ],
        "undoOperations": null
      }
    ]
  }
  ```

### 更新块

- `/api/block/updateBlock`
- **参数**：`{"dataType": "markdown", "data": "新内容", "id": "块ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": [
      {
        "doOperations": [
          {
            "action": "update",
            "data": "<div data-node-id=\"20211230161520-querkps\" data-node-index=\"1\" data-type=\"NodeParagraph\" class=\"p\"><div contenteditable=\"true\" spellcheck=\"false\">foo<strong>bar</strong>baz</div><div class=\"protyle-attr\" contenteditable=\"false\"></div></div>",
            "id": "20211230161520-querkps",
            "parentID": "",
            "previousID": "",
            "retData": null
          }
        ],
        "undoOperations": null
      }
    ]
  }
  ```

### 删除块

- `/api/block/deleteBlock`
- **参数**：`{"id": "块ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": [
      {
        "doOperations": [
          {
            "action": "delete",
            "data": null,
            "id": "20211230162439-vtm09qo",
            "parentID": "",
            "previousID": "",
            "retData": null
          }
        ],
        "undoOperations": null
      }
    ]
  }
  ```

### 移动块

- `/api/block/moveBlock`
- **参数**：`{"id": "待移动块ID", "previousID": "前一块ID", "parentID": "父块ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": [
      {
        "doOperations": [
          {
            "action": "move",
            "data": null,
            "id": "20230406180530-3o1rqkc",
            "parentID": "20230404183855-woe52ko",
            "previousID": "20230406152734-if5kyx6",
            "nextID": "",
            "retData": null,
            "srcIDs": null,
            "name": "",
            "type": ""
          }
        ],
        "undoOperations": null
      }
    ]
  }
  ```

### 折叠块

- `/api/block/foldBlock`
- **参数**：`{"id": "块ID"}`

### 展开块

- `/api/block/unfoldBlock`
- **参数**：`{"id": "块ID"}`

### 获取块 kramdown 源码

- `/api/block/getBlockKramdown`
- **参数**：`{"id": "块ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "id": "20201225220955-l154bn4",
      "kramdown": "* {: id=\"20201225220955-2nn1mns\"}新建笔记本，在笔记本下新建文档\n  {: id=\"20210131155408-3t627wc\"}\n* {: id=\"20201225220955-uwhqnug\"}在编辑器中输入 <kbd>/</kbd> 触发功能菜单\n  {: id=\"20210131155408-btnfw88\"}\n* {: id=\"20201225220955-04ymi2j\"}((20200813131152-0wk5akh \"在内容块中遨游\"))、((20200822191536-rm6hwid \"窗口和页签\"))\n  {: id=\"20210131155408-hh1z442\"}"
    }
  }
  ```

### 获取子块

- `/api/block/getChildBlocks`
- **参数**：`{"id": "父块ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": [
      {
        "id": "20230512083858-mjdwkbn",
        "type": "h",
        "subType": "h1"
      },
      {
        "id": "20230513213633-9lsj4ew",
        "type": "l",
        "subType": "u"
      }
    ]
  }
  ```

### 转移块引用

- `/api/block/transferBlockRef`
- **参数**：`{"fromID": "定义块ID", "toID": "目标块ID", "refIDs": ["引用块ID"]}` // refIDs 可选

## 属性

### 设置块属性

- `/api/attr/setBlockAttrs`
- **参数**：`{"id": "块ID", "attrs": {"custom-attr1": "值"}}` // 自定义属性需 `custom-` 前缀

### 获取块属性

- `/api/attr/getBlockAttrs`
- **参数**：`{"id": "块ID", "attrs": {"custom-attr1": "值"}}` // 自定义属性需 `custom-` 前缀
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "custom-attr1": "line1\nline2",
      "id": "20210912214605-uhi5gco",
      "title": "PDF 标注双链演示",
      "type": "doc",
      "updated": "20210916120715"
    }
  }
  ```

## SQL

### 执行 SQL 查询

- `/api/query/sql`
- **参数**：`{"stmt": "SQL 脚本"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": [
      { "列": "值" }
    ]
  }
  ```

### 提交事务

- `/api/sqlite/flushTransaction`

## 模板

### 渲染模板

- `/api/template/render`
- **参数**：`{"id": "文档ID", "path": "模板文件绝对路径"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "content": "<div data-node-id=\"20220729234848-dlgsah7\" data-node-index=\"1\" data-type=\"NodeParagraph\" class=\"p\" updated=\"20220729234840\"><div contenteditable=\"true\" spellcheck=\"false\">foo</div><div class=\"protyle-attr\" contenteditable=\"false\"></div></div>",
      "path": "F:\\SiYuan\\data\\templates\\foo.md"
    }
  }
  ```

### 渲染 Sprig

- `/api/template/renderSprig`
- **参数**：`{"template": "模板内容"}`
- 返回值

  ```json
  {
    "template": "/daily note/{{now | date \"2006/01\"}}/{{now | date \"2006-01-02\"}}"
  }
  ```

## 文件

### 获取文件

- `/api/file/getFile`
- **参数**：`{"path": "工作空间路径下的文件路径"}`
- 返回值

   `200`: 文件内容，`202`: 异常信息

  ```json
  {
    "code": 404,
    "msg": "",
    "data": null
  }
  ```

  - `code`: 非零的异常值

    - `1`: 参数解析错误
    - `403`: 无访问权限 (文件不在工作空间下)
    - `404`: 未找到 (文件不存在)
    - `405`: 方法不被允许 (这是一个目录)
    - `500`: 服务器错误 (文件查询失败 / 文件读取失败)
  - `msg`: 一段描述错误的文本

### 写入文件

- `/api/file/putFile`
- 参数为 HTTP Multipart 表单

  - `path`：工作空间路径下的文件路径
  - `isDir`：是否为创建文件夹。
  - `modTime`：最近访问和修改时间，Unix time
  - `file`：上传的文件

### 删除文件

- `/api/file/removeFile`
- `{"path": "工作空间路径下的文件路径"}`

### 重命名文件

- `/api/file/renameFile`
- **参数**：`{"path": "原路径", "newPath": "新路径"}`

### 列出文件

- `/api/file/readDir`
- **参数**：`{"path": "工作空间路径下的文件夹路径"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": [
      {
        "isDir": true,
        "isSymlink": false,
        "name": "20210808180303-6yi0dv5",
        "updated": 1691467624
      },
      {
        "isDir": false,
        "isSymlink": false,
        "name": "20210808180303-6yi0dv5.sy",
        "updated": 1663298365
      }
    ]
  }
  ```

## 导出

### 导出 Markdown 文本

- `/api/export/exportMdContent`
- **参数**：`{"id": "文档块ID"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "hPath": "/0 请从这里开始",
      "content": "## 🍫 内容块\n\n在思源中，唯一重要的核心概念是..."
    }
  }
  ```

### 导出文件与目录

- `/api/export/exportResources`
- 参数

  ```json
  {
    "paths": [
      "/conf/appearance/boot",
      "/conf/appearance/langs",
      "/conf/appearance/emojis/conf.json",
      "/conf/appearance/icons/index.html"
    ],
    "name": "zip-file-name"
  }
  ```

  - `paths`：要导出的文件或文件夹路径列表，相同名称的文件/文件夹会被覆盖
  - `name`：（可选）导出的文件名，未设置时默认为 `export-YYYY-MM-DD_hh-mm-ss.zip`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "path": "temp/export/zip-file-name.zip"
    }
  }
  ```

  - `path`：创建的 `.zip` 文件路径

    - `zip-file-name.zip` 中的目录结构如下所示：

      - `zip-file-name`

        - `boot`
        - `langs`
        - `conf.json`
        - `index.html`

## 转换

### Pandoc

- `/api/convert/pandoc`
- 工作目录

  - 执行调用 pandoc 命令时工作目录会被设置在 `工作空间/temp/convert/pandoc/${test}` 下
  - 可先通过 API [`写入文件`](about:blank#%E5%86%99%E5%85%A5%E6%96%87%E4%BB%B6) 将待转换文件写入该目录
  - 然后再调用该 API 进行转换，转换后的文件也会被写入该目录
  - 最后调用 API [`获取文件`](about:blank#%E8%8E%B7%E5%8F%96%E6%96%87%E4%BB%B6) 获取转换后的文件内容

    - 或者调用 API [`通过 Markdown 创建文档`](about:blank#%E9%80%9A%E8%BF%87-markdown-%E5%88%9B%E5%BB%BA%E6%96%87%E6%A1%A3)
    - 或者调用内部 API `importStdMd` 将转换后的文件夹直接导入
- 参数

  ```json
  {
    "dir": "test",
    "args": [
      "--to",
      "markdown_strict-raw_html",
      "foo.epub",
      "-o",
      "foo.md"
    ]
  }
  ```

  - `args`：Pandoc 命令行参数
- 返回值

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "path": "/temp/convert/pandoc/test"
  }
}
```

- `path`：工作空间下的路径

## 通知

### 推送消息

- `/api/notification/pushMsg`
- **参数**：`{"msg": "消息内容", "timeout": 持续时间（毫秒，可选）"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "id": "62jtmqi"
    }
  }
  ```

### 推送报错消息

- `/api/notification/pushErrMsg`
- **参数**：`{"msg": "错误消息", "timeout": 持续时间（毫秒，可选）"}`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "id": "qc9znut"
    }
  }
  ```

## 网络

### 正向代理

- `/api/network/forwardProxy`
- 参数

  ```json
  {
    "url": "https://b3log.org/siyuan/",
    "method": "GET",
    "timeout": 7000,
    "contentType": "text/html",
    "headers": [
      {
        "Cookie": ""
      }
    ],
    "payload": {},
    "payloadEncoding": "text",
    "responseEncoding": "text"
  }
  ```

  - `url`：转发的 URL
  - `method`：HTTP 方法，默认为 `GET`
  - `timeout`：超时时间，单位为毫秒，默认为 `7000` 毫秒
  - `contentType`：HTTP Content-Type，默认为 `application/json`
  - `headers`：HTTP 请求标头
  - `payload`：HTTP 请求体，对象或者是字符串
  - `payloadEncoding`：`pyaload` 所使用的编码方案，默认为 `text`，可选值如下所示

    - `text`
    - `base64` | `base64-std`
    - `base64-url`
    - `base32` | `base32-std`
    - `base32-hex`
    - `hex`
  - `responseEncoding`：响应数据中 `body` 字段所使用的编码方案，默认为 `text`，可选值如下所示
  - `text`
  - `base64` | `base64-std`
  - `base64-url`
  - `base32` | `base32-std`
  - `base32-hex`
  - `hex`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "body": "",
      "bodyEncoding": "text",
      "contentType": "text/html",
      "elapsed": 1976,
      "headers": {
      },
      "status": 200,
      "url": "https://b3log.org/siyuan"
    }
  }
  ```

  - `bodyEncoding`：`body` 所使用的编码方案，与请求中 `responseEncoding` 字段一致，默认为 `text`，可能的值如下所示

    - `text`
    - `base64` | `base64-std`
    - `base64-url`
    - `base32` | `base32-std`
    - `base32-hex`
    - `hex`

## 系统

### 刷新页面

- /api/system/reloadUI
- POST

### 获取启动进度

- `/api/system/bootProgress`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": {
      "details": "Finishing boot...",
      "progress": 100
    }
  }
  ```

### 获取系统版本

- `/api/system/version`
- get/post

  ```json
  {
    "code": 0,
    "msg": "",
    "data": "1.3.5"
  }
  ```

### 获取系统当前时间

- `/api/system/currentTime`
- 返回值

  ```json
  {
    "code": 0,
    "msg": "",
    "data": 1631850968131
  }
  ```

  - `data`: 精度为毫秒

### 获取系统配置

- /api/system/getConf
- post

## 数据库

### 查询数据库所有列字段

- /api/av/getAttributeViewKeysByAvID
- post
- **参数**：`{"avID": "数据库ID"}`

### 更新数据库字段

- /api/av/setAttributeViewBlockAttr
- post

### 获取数据库的所有key（列id）

```
let res = await fetchSyncPost("/api/av/getAttributeViewKeysByAvID", {
   avID:  '数据库ID'
});
```

### 查询哪些数据库包含了这个块

```
let res = await fetchSyncPost("/api/av/getAttributeViewKeys", {
   id:  '块ID'
});
```

## 解析 markdown 文本

桌面端思源内置 `Lute` 工具用于 Markdown 解析。

```
let lute = window.Lute.New();
lute.Md2HTML('## Hello')
// 输出: '<h2>Hello</h2>\n'
```

## 使用 Node/electron API

桌面端的思源可以直接访问 Node 环境包和 Electron API。

```
const nodeFs = window.require('fs') as typeof import('fs');
const nodePath = window.require('path') as typeof import('path');
const electron = window.require('electron');
```
